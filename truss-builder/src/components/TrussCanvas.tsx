import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisResult, JointId, ToolMode, Truss } from '../truss/types'
import { clamp, jointById, memberLengthM, snap } from '../truss/geometry'
import type { ConstraintSummary } from '../truss/constraints'
import { formatCoordinate } from '../truss/precision'

type ViewBox = { x: number; y: number; w: number; h: number }

function worldFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = svg.createSVGPoint()
  p.x = clientX
  p.y = clientY
  const w = p.matrixTransform(ctm.inverse())
  return { x: w.x, y: w.y }
}

function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadPngFromSvg(svgEl: SVGSVGElement, filename: string) {
  const cloned = svgEl.cloneNode(true) as SVGSVGElement
  cloned.removeAttribute('style')
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const svgText = new XMLSerializer().serializeToString(cloned)
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)
  const img = new Image()
  const load = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load SVG for PNG export'))
  })
  img.src = svgUrl
  await load
  const r = svgEl.getBoundingClientRect()
  const w = Math.max(1, Math.floor(r.width * 2))
  const h = Math.max(1, Math.floor(r.height * 2))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
  URL.revokeObjectURL(svgUrl)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const TOOL_LABELS: Record<ToolMode, string> = {
  select: 'Select',
  joint: 'Add Joint',
  member: 'Add Member',
  support: 'Set Support',
  load: 'Set Load',
}

export function TrussCanvas(props: {
  truss: Truss
  setTruss: (t: Truss) => void
  commitTrussFrom: (prev: Truss, next: Truss) => void
  setTrussTransient: (t: Truss) => void
  tool: ToolMode
  gridStepM: number
  analysis: AnalysisResult
  constraints: ConstraintSummary
  selected: { jointId: JointId | null; memberId: string | null }
  setSelected: (s: { jointId: JointId | null; memberId: string | null }) => void
  deleteSelected: () => void
  supportType: 'pinned' | 'roller'
}) {
  const {
    truss, setTruss, commitTrussFrom, setTrussTransient,
    tool, gridStepM, analysis, selected, setSelected, deleteSelected,
    supportType,
  } = props
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [viewBox, setViewBox] = useState<ViewBox>({ x: -2, y: -1, w: 16, h: 10 })
  const [memberStart, setMemberStart] = useState<JointId | null>(null)
  const [dragJointId, setDragJointId] = useState<JointId | null>(null)
  const [dragStartTruss, setDragStartTruss] = useState<Truss | null>(null)
  const [hoverJoint, setHoverJoint] = useState<{ x: number; y: number } | null>(null)
  const [panStart, setPanStart] = useState<{
    clientX: number; clientY: number; vb: ViewBox; active: boolean
  } | null>(null)
  const [suppressNextClick, setSuppressNextClick] = useState(false)

  // Keep a ref to the current viewBox for pinch-zoom calculations (avoids stale closure)
  const viewBoxRef = useRef(viewBox)
  useEffect(() => { viewBoxRef.current = viewBox }, [viewBox])

  // Track active pointers for pinch-to-zoom
  const touchPointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map())
  const pinchRef = useRef<{ dist: number; vb: ViewBox } | null>(null)

  // Keep viewBox.h in sync with the SVG element's real pixel aspect ratio so the
  // grid fills edge-to-edge with no letterboxing.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const sync = () => {
      const { clientWidth: w, clientHeight: h } = svg
      if (w > 0 && h > 0) {
        setViewBox((prev) => ({ ...prev, h: prev.w * h / w }))
      }
    }
    const ro = new ResizeObserver(sync)
    ro.observe(svg)
    sync()
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.jointId || selected.memberId) {
          e.preventDefault()
          deleteSelected()
        }
      }
      if (e.key === 'Escape') {
        setSelected({ jointId: null, memberId: null })
        setMemberStart(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, selected.jointId, selected.memberId, setSelected])

  const forceByMemberId = useMemo(() => {
    if (!analysis.ok) return new Map<string, number>()
    return new Map(analysis.memberForces.map((f) => [f.memberId, f.forcekN]))
  }, [analysis])

  const gridMinor = gridStepM
  const gridMajor = 2 * gridStepM
  const gridFine = Math.max(gridStepM / 5, 0.001)

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const mouse = worldFromClient(svg, e.clientX, e.clientY)
    const zoom = Math.exp(clamp(-e.deltaY, -200, 200) / 500)
    const nextW = clamp(viewBox.w / zoom, 4, 200)
    const { clientWidth: pw, clientHeight: ph } = svg
    const nextH = pw > 0 ? nextW * ph / pw : nextW * viewBox.h / viewBox.w
    const nx = (mouse.x - viewBox.x) / viewBox.w
    const ny = (mouse.y - viewBox.y) / viewBox.h
    setViewBox({ x: mouse.x - nx * nextW, y: mouse.y - ny * nextH, w: nextW, h: nextH })
  }

  const onBackgroundPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return
    const svg = svgRef.current
    if (!svg) return

    touchPointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })

    if (touchPointersRef.current.size === 2) {
      // Second finger down — start pinch zoom
      const ptrs = [...touchPointersRef.current.values()]
      const dist = Math.hypot(ptrs[1].clientX - ptrs[0].clientX, ptrs[1].clientY - ptrs[0].clientY)
      pinchRef.current = { dist, vb: viewBoxRef.current }
      setPanStart(null)
      return
    }

    svg.setPointerCapture(e.pointerId)
    setPanStart({ clientX: e.clientX, clientY: e.clientY, vb: viewBox, active: false })
  }

  const onPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    const svg = svgRef.current
    if (!svg) return

    // Update pointer tracking
    if (touchPointersRef.current.has(e.pointerId)) {
      touchPointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })
    }

    // Pinch-to-zoom: two fingers on background
    if (touchPointersRef.current.size === 2 && pinchRef.current) {
      const ptrs = [...touchPointersRef.current.values()]
      const [p0, p1] = ptrs
      const currentDist = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY)
      const midClientX = (p0.clientX + p1.clientX) / 2
      const midClientY = (p0.clientY + p1.clientY) / 2

      const { dist: startDist, vb: startVb } = pinchRef.current
      if (startDist < 5) return

      const totalZoom = currentDist / startDist
      const nextW = clamp(startVb.w / totalZoom, 4, 200)
      const { clientWidth: pw, clientHeight: ph } = svg
      const nextH = pw > 0 ? nextW * ph / pw : (nextW * startVb.h) / startVb.w

      const midWorld = worldFromClient(svg, midClientX, midClientY)
      const nx = (midWorld.x - viewBox.x) / viewBox.w
      const ny = (midWorld.y - viewBox.y) / viewBox.h

      setViewBox({ x: midWorld.x - nx * nextW, y: midWorld.y - ny * nextH, w: nextW, h: nextH })
      return
    }

    // Hover preview for joint placement
    if (tool === 'joint' && !dragJointId && !(panStart?.active ?? false)) {
      const p = worldFromClient(svg, e.clientX, e.clientY)
      setHoverJoint({ x: snap(p.x, gridStepM), y: snap(p.y, gridStepM) })
    } else if (hoverJoint) {
      setHoverJoint(null)
    }

    // Drag joint
    if (dragJointId) {
      const p = worldFromClient(svg, e.clientX, e.clientY)
      setTrussTransient({
        ...truss,
        joints: truss.joints.map((j) =>
          j.id === dragJointId ? { ...j, x: snap(p.x, gridStepM), y: snap(p.y, gridStepM) } : j
        ),
      })
      return
    }

    // Pan
    if (panStart) {
      const dxPx = e.clientX - panStart.clientX
      const dyPx = e.clientY - panStart.clientY
      const movedEnough = Math.hypot(dxPx, dyPx) > 3
      const isActive = panStart.active || movedEnough
      if (!panStart.active && isActive) setPanStart({ ...panStart, active: true })
      const r = svg.getBoundingClientRect()
      if (isActive) {
        setViewBox({
          ...panStart.vb,
          x: panStart.vb.x - (e.clientX - panStart.clientX) / r.width * panStart.vb.w,
          y: panStart.vb.y - (e.clientY - panStart.clientY) / r.height * panStart.vb.h,
        })
      }
    }
  }

  const onPointerUp: React.PointerEventHandler<SVGSVGElement> = (e) => {
    touchPointersRef.current.delete(e.pointerId)
    if (touchPointersRef.current.size < 2) {
      pinchRef.current = null
    }

    if (dragJointId && dragStartTruss) {
      commitTrussFrom(dragStartTruss, truss)
    }
    setDragJointId(null)
    setDragStartTruss(null)
    if (panStart?.active) {
      setSuppressNextClick(true)
      setTimeout(() => setSuppressNextClick(false), 0)
    }
    setPanStart(null)
  }

  const onPointerLeave: React.PointerEventHandler<SVGSVGElement> = () => {
    setHoverJoint(null)
  }

  const onBackgroundClick: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (tool !== 'joint') return
    const svg = svgRef.current
    if (!svg || suppressNextClick) return
    const p = worldFromClient(svg, e.clientX, e.clientY)
    const id = globalThis.crypto?.randomUUID?.() ?? `j_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setTruss({
      ...truss,
      joints: [...truss.joints, { id, label: '?', x: snap(p.x, gridStepM), y: snap(p.y, gridStepM), support: 'none', loadYkN: 0 }],
    })
  }

  const onJointPointerDown = (id: JointId) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // Track for pinch detection
    touchPointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })
    // Only start drag if single touch
    if (touchPointersRef.current.size === 1) {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      setDragStartTruss(truss)
      setDragJointId(id)
    }
  }

  const onJointClick = (id: JointId) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tool === 'select') {
      setSelected({ jointId: id, memberId: null })
      return
    }
    if (tool === 'member') {
      if (!memberStart) { setMemberStart(id); return }
      if (memberStart === id) return
      const already = truss.members.some(
        (m) => (m.a === memberStart && m.b === id) || (m.a === id && m.b === memberStart)
      )
      if (!already) {
        const memId = globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
        setTruss({ ...truss, members: [...truss.members, { id: memId, a: memberStart, b: id, multiplier: 1 }] })
      }
      setMemberStart(null)
      return
    }
    if (tool === 'support') {
      setTruss({
        ...truss,
        joints: truss.joints.map((j) => {
          if (j.id !== id) return j
          if (supportType === 'pinned') {
            return { ...j, support: j.support === 'pinned' ? 'none' : 'pinned' }
          }
          // roller: rotate 90° each click through full 360°
          if (j.support === 'none' || j.support === 'pinned') return { ...j, support: 'roller' }
          if (j.support === 'roller') return { ...j, support: 'roller-x' }
          if (j.support === 'roller-x') return { ...j, support: 'roller-up' }
          if (j.support === 'roller-up') return { ...j, support: 'roller-left' }
          return { ...j, support: 'roller' } // roller-left → back to start
        }),
      })
      return
    }
    if (tool === 'load') {
      const joint = jointById(truss, id)
      const current = joint?.loadYkN ?? 0
      const str = window.prompt('Vertical load at joint (kN, +down). Use 0 to clear.', String(current))
      if (str == null) return
      const val = Number(str)
      if (!Number.isFinite(val)) return
      setTruss({ ...truss, joints: truss.joints.map((j) => (j.id === id ? { ...j, loadYkN: val } : j)) })
    }
  }

  const onMemberClick = (memberId: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (tool === 'select') {
      setSelected({ jointId: null, memberId })
      return
    }
    const mem = truss.members.find((x) => x.id === memberId)
    if (!mem) return
    const nextStr = window.prompt('Member multiplier (1, 2, or 3).', String(mem.multiplier))
    if (nextStr == null) return
    const next = Number(nextStr)
    if (next !== 1 && next !== 2 && next !== 3) return
    setTruss({ ...truss, members: truss.members.map((m) => (m.id === memberId ? { ...m, multiplier: next } : m)) })
  }

  const exportSvg = () => {
    const svg = svgRef.current
    if (!svg) return
    const cloned = svg.cloneNode(true) as SVGSVGElement
    cloned.removeAttribute('style')
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    downloadText('truss-builder.svg', new XMLSerializer().serializeToString(cloned), 'image/svg+xml')
  }

  const exportPng = async () => {
    const svg = svgRef.current
    if (!svg) return
    await downloadPngFromSvg(svg, 'truss-builder.png')
  }

  ;(window as any).__TRUSS_EXPORT_SVG__ = exportSvg
  ;(window as any).__TRUSS_EXPORT_PNG__ = exportPng

  const jointLabelById = useMemo(() => {
    const map = new Map<JointId, string>()
    truss.joints.forEach((j) => map.set(j.id, j.label || '?'))
    return map
  }, [truss.joints])

  return (
    <div className="relative h-full w-full bg-slate-50">
      <svg
        ref={svgRef}
        className="h-full w-full select-none touch-none"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClick={onBackgroundClick}
      >
        <defs>
          <pattern id="fineGrid" width={gridFine} height={gridFine} patternUnits="userSpaceOnUse">
            <path d={`M ${gridFine} 0 L 0 0 0 ${gridFine}`} fill="none" stroke="#f1f5f9" strokeWidth={0.01} />
          </pattern>
          <pattern id="minorGrid" width={gridMinor} height={gridMinor} patternUnits="userSpaceOnUse">
            <rect width={gridMinor} height={gridMinor} fill="url(#fineGrid)" />
            <path d={`M ${gridMinor} 0 L 0 0 0 ${gridMinor}`} fill="none" stroke="#e2e8f0" strokeWidth={0.02} />
          </pattern>
          <pattern id="majorGrid" width={gridMajor} height={gridMajor} patternUnits="userSpaceOnUse">
            <rect width={gridMajor} height={gridMajor} fill="url(#minorGrid)" />
            <path d={`M ${gridMajor} 0 L 0 0 0 ${gridMajor}`} fill="none" stroke="#cbd5e1" strokeWidth={0.03} />
          </pattern>
        </defs>

        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#majorGrid)" />

        {/* Joint placement ghost */}
        {tool === 'joint' && hoverJoint && (
          <g pointerEvents="none">
            <circle
              cx={hoverJoint.x} cy={hoverJoint.y} r={0.18}
              fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.6)" strokeWidth={0.07}
            />
          </g>
        )}

        {/* Axes */}
        <line x1={-1e4} y1={0} x2={1e4} y2={0} stroke="#94a3b8" strokeWidth={0.04} />
        <line x1={0} y1={-1e4} x2={0} y2={1e4} stroke="#94a3b8" strokeWidth={0.04} />

        {/* Members */}
        {truss.members.map((mem) => {
          const a = jointById(truss, mem.a)
          const b = jointById(truss, mem.b)
          if (!a || !b) return null
          const len = memberLengthM(truss, mem)
          const tooLong = Number.isFinite(len) && len > 3.0000001
          const f = forceByMemberId.get(mem.id)
          const absF = f == null ? null : Math.abs(f)
          const capacity = 12 * mem.multiplier
          const forceTooHigh = absF != null && absF > capacity + 0.0000001
          const hasForce = f != null && Number.isFinite(f)
          let stroke = '#334155'
          if (tooLong) stroke = '#ef4444'
          if (hasForce) {
            stroke = f! >= 0 ? '#2563eb' : '#16a34a'
            if (forceTooHigh) stroke = '#ef4444'
          }
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const isSelected = selected.memberId === mem.id
          return (
            <g key={mem.id}>
              {/* Wider invisible hit area for easier clicking */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={0.4}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onMemberClick(mem.id)}
                style={{ cursor: 'pointer' }}
              />
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isSelected ? '#f59e0b' : stroke}
                strokeWidth={isSelected ? 0.2 : mem.multiplier === 3 ? 0.18 : mem.multiplier === 2 ? 0.14 : 0.1}
                pointerEvents="none"
              />
              <text x={mx} y={my - 0.1} fontSize={0.28} fill="#475569" textAnchor="middle" pointerEvents="none">
                {Number.isFinite(len) ? `${len.toFixed(2)} m` : ''}
                {mem.multiplier > 1 ? ` ×${mem.multiplier}` : ''}
              </text>
              {hasForce && (
                <text x={mx} y={my + 0.32} fontSize={0.26} fill={stroke} textAnchor="middle" pointerEvents="none">
                  {f!.toFixed(2)} kN
                </text>
              )}
            </g>
          )
        })}

        {/* Joints */}
        {truss.joints.map((j) => {
          const isMemberStart = memberStart === j.id
          const isSelected = selected.jointId === j.id
          const isRoller = j.support === 'roller' || j.support === 'roller-x' || j.support === 'roller-up' || j.support === 'roller-left'
          const jointColor = j.support === 'pinned' ? '#7c3aed' : isRoller ? '#0ea5e9' : '#334155'
          return (
            <g key={j.id}>
              {/* Load arrow */}
              {j.loadYkN !== 0 && (
                <g
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    const str = window.prompt('Vertical load at joint (kN, +down). Use 0 to clear.', String(j.loadYkN))
                    if (str == null) return
                    const val = Number(str)
                    if (!Number.isFinite(val)) return
                    setTruss({ ...truss, joints: truss.joints.map((jj) => jj.id === j.id ? { ...jj, loadYkN: val } : jj) })
                  }}
                >
                  <line x1={j.x} y1={j.y - 0.15} x2={j.x} y2={j.y + 0.85} stroke="#ef4444" strokeWidth={0.07} />
                  <polygon
                    points={`${j.x - 0.16},${j.y + 0.85} ${j.x + 0.16},${j.y + 0.85} ${j.x},${j.y + 1.1}`}
                    fill="#ef4444"
                  />
                  <text x={j.x + 0.22} y={j.y + 0.2} fontSize={0.28} fill="#ef4444" style={{ userSelect: 'none' }}>
                    {j.loadYkN.toFixed(2)} kN
                  </text>
                  {/* Transparent hit area covering the arrow */}
                  <rect x={j.x - 0.3} y={j.y - 0.2} width={0.8} height={1.4} fill="transparent" />
                </g>
              )}

              {/* Enlarged transparent hit area */}
              <circle
                cx={j.x} cy={j.y} r={0.4}
                fill="transparent" stroke="none"
                onPointerDown={onJointPointerDown(j.id)}
                onClick={onJointClick(j.id)}
                style={{ cursor: tool === 'select' || tool === 'member' ? 'pointer' : 'crosshair' }}
              />

              {/* Support symbol */}
              {j.support === 'pinned' && (
                <g pointerEvents="none">
                  <polygon
                    points={`${j.x},${j.y + 0.02} ${j.x - 0.27},${j.y + 0.46} ${j.x + 0.27},${j.y + 0.46}`}
                    fill="#ede9fe" stroke="#7c3aed" strokeWidth={0.045}
                  />
                  <line x1={j.x - 0.34} y1={j.y + 0.46} x2={j.x + 0.34} y2={j.y + 0.46} stroke="#7c3aed" strokeWidth={0.05} />
                  {([-0.22, -0.08, 0.06, 0.20] as number[]).map((dx) => (
                    <line key={dx} x1={j.x + dx} y1={j.y + 0.46} x2={j.x + dx - 0.1} y2={j.y + 0.6} stroke="#7c3aed" strokeWidth={0.035} />
                  ))}
                </g>
              )}
              {j.support === 'roller' && (
                <g pointerEvents="none">
                  {/* Triangle pointing down */}
                  <polygon
                    points={`${j.x},${j.y + 0.02} ${j.x - 0.27},${j.y + 0.43} ${j.x + 0.27},${j.y + 0.43}`}
                    fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={0.045}
                  />
                  {([-0.15, 0, 0.15] as number[]).map((dx) => (
                    <circle key={dx} cx={j.x + dx} cy={j.y + 0.53} r={0.07} fill="white" stroke="#0ea5e9" strokeWidth={0.04} />
                  ))}
                  <line x1={j.x - 0.34} y1={j.y + 0.62} x2={j.x + 0.34} y2={j.y + 0.62} stroke="#0ea5e9" strokeWidth={0.05} />
                  {([-0.22, -0.08, 0.06, 0.20] as number[]).map((dx) => (
                    <line key={dx} x1={j.x + dx} y1={j.y + 0.62} x2={j.x + dx - 0.1} y2={j.y + 0.76} stroke="#0ea5e9" strokeWidth={0.035} />
                  ))}
                </g>
              )}
              {j.support === 'roller-x' && (
                <g pointerEvents="none">
                  <polygon
                    points={`${j.x + 0.02},${j.y} ${j.x + 0.43},${j.y - 0.27} ${j.x + 0.43},${j.y + 0.27}`}
                    fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={0.045}
                  />
                  {([-0.15, 0, 0.15] as number[]).map((dy) => (
                    <circle key={dy} cx={j.x + 0.53} cy={j.y + dy} r={0.07} fill="white" stroke="#0ea5e9" strokeWidth={0.04} />
                  ))}
                  <line x1={j.x + 0.62} y1={j.y - 0.34} x2={j.x + 0.62} y2={j.y + 0.34} stroke="#0ea5e9" strokeWidth={0.05} />
                  {([-0.22, -0.08, 0.06, 0.20] as number[]).map((dy) => (
                    <line key={dy} x1={j.x + 0.62} y1={j.y + dy} x2={j.x + 0.76} y2={j.y + dy - 0.1} stroke="#0ea5e9" strokeWidth={0.035} />
                  ))}
                </g>
              )}
              {j.support === 'roller-up' && (
                <g pointerEvents="none">
                  {/* Triangle pointing up — apex at joint */}
                  <polygon
                    points={`${j.x},${j.y - 0.02} ${j.x - 0.27},${j.y - 0.43} ${j.x + 0.27},${j.y - 0.43}`}
                    fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={0.045}
                  />
                  {([-0.15, 0, 0.15] as number[]).map((dx) => (
                    <circle key={dx} cx={j.x + dx} cy={j.y - 0.53} r={0.07} fill="white" stroke="#0ea5e9" strokeWidth={0.04} />
                  ))}
                  <line x1={j.x - 0.34} y1={j.y - 0.62} x2={j.x + 0.34} y2={j.y - 0.62} stroke="#0ea5e9" strokeWidth={0.05} />
                  {([-0.22, -0.08, 0.06, 0.20] as number[]).map((dx) => (
                    <line key={dx} x1={j.x + dx} y1={j.y - 0.62} x2={j.x + dx - 0.1} y2={j.y - 0.76} stroke="#0ea5e9" strokeWidth={0.035} />
                  ))}
                </g>
              )}
              {j.support === 'roller-left' && (
                <g pointerEvents="none">
                  {/* Triangle pointing left — apex at joint */}
                  <polygon
                    points={`${j.x - 0.02},${j.y} ${j.x - 0.43},${j.y - 0.27} ${j.x - 0.43},${j.y + 0.27}`}
                    fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={0.045}
                  />
                  {([-0.15, 0, 0.15] as number[]).map((dy) => (
                    <circle key={dy} cx={j.x - 0.53} cy={j.y + dy} r={0.07} fill="white" stroke="#0ea5e9" strokeWidth={0.04} />
                  ))}
                  <line x1={j.x - 0.62} y1={j.y - 0.34} x2={j.x - 0.62} y2={j.y + 0.34} stroke="#0ea5e9" strokeWidth={0.05} />
                  {([-0.22, -0.08, 0.06, 0.20] as number[]).map((dy) => (
                    <line key={dy} x1={j.x - 0.62} y1={j.y + dy} x2={j.x - 0.76} y2={j.y + dy - 0.1} stroke="#0ea5e9" strokeWidth={0.035} />
                  ))}
                </g>
              )}

              {/* Selection halo */}
              {isSelected && (
                <circle cx={j.x} cy={j.y} r={0.32} fill="none" stroke="#f59e0b" strokeWidth={0.08} opacity={0.6} pointerEvents="none" />
              )}

              {/* Visible joint */}
              <circle
                cx={j.x} cy={j.y} r={0.18}
                fill={isMemberStart ? '#fde68a' : 'white'}
                stroke={isSelected ? '#f59e0b' : jointColor}
                strokeWidth={isSelected ? 0.12 : 0.07}
                pointerEvents="none"
              />

              {/* Label */}
              <text x={j.x + 0.26} y={j.y - 0.26} fontSize={0.28} fill="#334155" fontWeight="600" pointerEvents="none">
                {jointLabelById.get(j.id) ?? '?'}
              </text>
              <text x={j.x + 0.26} y={j.y - 0.02} fontSize={0.22} fill="#94a3b8" pointerEvents="none">
                ({formatCoordinate(j.x, 2)}, {formatCoordinate(j.y, 2)})
              </text>
            </g>
          )
        })}
      </svg>

      {/* Status bar */}
      <div className="absolute bottom-14 left-0 right-0 flex items-center gap-3 border-t border-slate-200/80 bg-white/95 px-3 py-1.5 text-xs backdrop-blur-sm lg:bottom-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Mode</span>
          <span className="font-semibold text-slate-700">{TOOL_LABELS[tool]}</span>
        </div>
        {tool === 'member' && memberStart && (
          <span className="text-indigo-600">
            From <strong>{jointLabelById.get(memberStart)}</strong> — click second joint
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-slate-400">
          <span className="hidden sm:inline">Scroll to zoom · Drag to pan · Pinch to zoom</span>
          <button
            type="button"
            className="rounded-md px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-100 [touch-action:manipulation]"
            onClick={exportSvg}
          >
            Export SVG
          </button>
        </div>
      </div>
    </div>
  )
}
