import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisResult, JointId, ToolMode, Truss } from '../truss/types'
import { clamp, jointById, memberLengthM, snap } from '../truss/geometry'
import type { ConstraintSummary } from '../truss/constraints'

type ViewBox = { x: number; y: number; w: number; h: number }

function worldFromClient(svg: SVGSVGElement, _vb: ViewBox, clientX: number, clientY: number) {
  // Correctly accounts for preserveAspectRatio letterboxing / transforms.
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
  onRequestExportSvg?: (svgEl: SVGSVGElement) => void
}) {
  const {
    truss,
    setTruss,
    commitTrussFrom,
    setTrussTransient,
    tool,
    gridStepM,
    analysis,
    selected,
    setSelected,
    deleteSelected,
  } = props
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [viewBox, setViewBox] = useState<ViewBox>({ x: -2, y: -1, w: 16, h: 10 })
  const [memberStart, setMemberStart] = useState<JointId | null>(null)
  const [dragJointId, setDragJointId] = useState<JointId | null>(null)
  const [dragStartTruss, setDragStartTruss] = useState<Truss | null>(null)
  const [hoverJoint, setHoverJoint] = useState<{ x: number; y: number } | null>(null)
  const [panStart, setPanStart] = useState<{
    clientX: number
    clientY: number
    vb: ViewBox
    active: boolean
  } | null>(null)
  const [suppressNextClick, setSuppressNextClick] = useState(false)

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

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const mouse = worldFromClient(svg, viewBox, e.clientX, e.clientY)

    const zoom = Math.exp(clamp(-e.deltaY, -200, 200) / 500)
    const nextW = clamp(viewBox.w / zoom, 4, 200)
    const nextH = (nextW * viewBox.h) / viewBox.w

    const nx = (mouse.x - viewBox.x) / viewBox.w
    const ny = (mouse.y - viewBox.y) / viewBox.h
    const nextX = mouse.x - nx * nextW
    const nextY = mouse.y - ny * nextH
    setViewBox({ x: nextX, y: nextY, w: nextW, h: nextH })
  }

  const onBackgroundPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (e.button !== 0) return
    const svg = svgRef.current
    if (!svg) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setPanStart({ clientX: e.clientX, clientY: e.clientY, vb: viewBox, active: false })
  }

  const onPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    const svg = svgRef.current
    if (!svg) return

    if (tool === 'joint' && !dragJointId && !(panStart?.active ?? false)) {
      const p = worldFromClient(svg, viewBox, e.clientX, e.clientY)
      const x = snap(p.x, gridStepM)
      const y = snap(p.y, gridStepM)
      setHoverJoint({ x, y })
    } else if (hoverJoint) {
      setHoverJoint(null)
    }

    if (dragJointId) {
      const p = worldFromClient(svg, viewBox, e.clientX, e.clientY)
      const x = snap(p.x, gridStepM)
      const y = snap(p.y, gridStepM)
      setTrussTransient({
        ...truss,
        joints: truss.joints.map((j) => (j.id === dragJointId ? { ...j, x, y } : j)),
      })
      return
    }

    if (panStart) {
      const dxPx = e.clientX - panStart.clientX
      const dyPx = e.clientY - panStart.clientY
      const movedEnough = Math.hypot(dxPx, dyPx) > 3
      const isActive = panStart.active || movedEnough
      if (!panStart.active && isActive) setPanStart({ ...panStart, active: true })
      const r = svg.getBoundingClientRect()
      const dxN = (e.clientX - panStart.clientX) / r.width
      const dyN = (e.clientY - panStart.clientY) / r.height
      if (isActive) {
        setViewBox({
          ...panStart.vb,
          x: panStart.vb.x - dxN * panStart.vb.w,
          y: panStart.vb.y - dyN * panStart.vb.h,
        })
      }
    }
  }

  const onPointerUp: React.PointerEventHandler<SVGSVGElement> = () => {
    if (dragJointId && dragStartTruss) {
      // Commit one undo-step for the entire drag.
      commitTrussFrom(dragStartTruss, truss)
    }
    setDragJointId(null)
    setDragStartTruss(null)
    if (panStart?.active) {
      // Prevent the subsequent click from placing a joint due to viewBox shift.
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
    if (!svg) return
    if (suppressNextClick) return

    const p = worldFromClient(svg, viewBox, e.clientX, e.clientY)
    const x = snap(p.x, gridStepM)
    const y = snap(p.y, gridStepM)

    const id = globalThis.crypto?.randomUUID?.() ?? `j_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const label = '?'
    setTruss({
      ...truss,
      joints: [...truss.joints, { id, label, x, y, support: 'none', loadYkN: 0 }],
    })
  }

  const onJointPointerDown = (id: JointId) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDragStartTruss(truss)
    setDragJointId(id)
  }

  const onJointClick = (id: JointId) => (e: React.MouseEvent) => {
    e.stopPropagation()

    if (tool === 'select') {
      setSelected({ jointId: id, memberId: null })
      return
    }

    if (tool === 'member') {
      if (!memberStart) {
        setMemberStart(id)
        return
      }
      if (memberStart === id) return

      const a = memberStart
      const b = id
      const already = truss.members.some(
        (m) => (m.a === a && m.b === b) || (m.a === b && m.b === a),
      )
      if (!already) {
        const memId = globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
        setTruss({
          ...truss,
          members: [...truss.members, { id: memId, a, b, multiplier: 1 }],
        })
      }
      setMemberStart(null)
      return
    }

    if (tool === 'support') {
      setTruss({
        ...truss,
        joints: truss.joints.map((j) => {
          if (j.id !== id) return j
          const next =
            j.support === 'none' ? 'pinned' : j.support === 'pinned' ? 'roller' : 'none'
          return { ...j, support: next }
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
      setTruss({
        ...truss,
        joints: truss.joints.map((j) => (j.id === id ? { ...j, loadYkN: val } : j)),
      })
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
    setTruss({
      ...truss,
      members: truss.members.map((m) => (m.id === memberId ? { ...m, multiplier: next } : m)),
    })
  }

  const exportSvg = () => {
    const svg = svgRef.current
    if (!svg) return
    const cloned = svg.cloneNode(true) as SVGSVGElement
    cloned.removeAttribute('style')
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const text = new XMLSerializer().serializeToString(cloned)
    downloadText('truss-builder.svg', text, 'image/svg+xml')
  }

  const exportPng = async () => {
    const svg = svgRef.current
    if (!svg) return
    await downloadPngFromSvg(svg, 'truss-builder.png')
  }

  // Expose export to parent via helper shortcut (used by left panel)
  ;(window as any).__TRUSS_EXPORT_SVG__ = exportSvg
  ;(window as any).__TRUSS_EXPORT_PNG__ = exportPng

  // Build joint labels deterministically by order in array.
  // App sets labels too, but we also guard here for safety.
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
          <pattern
            id="minorGrid"
            width={gridMinor}
            height={gridMinor}
            patternUnits="userSpaceOnUse"
          >
            <path d={`M ${gridMinor} 0 L 0 0 0 ${gridMinor}`} fill="none" stroke="#e2e8f0" strokeWidth={0.02} />
          </pattern>
          <pattern
            id="majorGrid"
            width={gridMajor}
            height={gridMajor}
            patternUnits="userSpaceOnUse"
          >
            <rect width={gridMajor} height={gridMajor} fill="url(#minorGrid)" />
            <path d={`M ${gridMajor} 0 L 0 0 0 ${gridMajor}`} fill="none" stroke="#cbd5e1" strokeWidth={0.03} />
          </pattern>
        </defs>

        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#majorGrid)" />

        {/* Joint placement preview */}
        {tool === 'joint' && hoverJoint ? (
          <g pointerEvents="none">
            <circle
              cx={hoverJoint.x}
              cy={hoverJoint.y}
              r={0.18}
              fill="rgba(148, 163, 184, 0.12)"
              stroke="rgba(100, 116, 139, 0.7)"
              strokeWidth={0.08}
            />
          </g>
        ) : null}

        {/* Axes */}
        <line x1={-1e4} y1={0} x2={1e4} y2={0} stroke="#94a3b8" strokeWidth={0.05} />
        <line x1={0} y1={-1e4} x2={0} y2={1e4} stroke="#94a3b8" strokeWidth={0.05} />

        {/* Members */}
        {truss.members.map((mem) => {
          const a = jointById(truss, mem.a)
          const b = jointById(truss, mem.b)
          if (!a || !b) return null
          const len = memberLengthM(truss, mem)
          const tooLong = Number.isFinite(len) && len > 3.0000001
          const f = forceByMemberId.get(mem.id)
          const absF = f == null ? null : Math.abs(f)
          const forceTooHigh = absF != null && absF > 12.0000001
          const hasForce = f != null && Number.isFinite(f)

          let stroke = '#0f172a'
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
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={isSelected ? 0.18 : 0.12}
                onClick={onMemberClick(mem.id)}
              />
              <text x={mx} y={my} fontSize={0.35} fill="#0f172a" textAnchor="middle">
                {Number.isFinite(len) ? `${len.toFixed(2)}m` : ''}
                {mem.multiplier > 1 ? ` ×${mem.multiplier}` : ''}
              </text>
              {hasForce ? (
                <text x={mx} y={my + 0.4} fontSize={0.32} fill={stroke} textAnchor="middle">
                  {f!.toFixed(2)} kN
                </text>
              ) : null}
            </g>
          )
        })}

        {/* Joints */}
        {truss.joints.map((j) => {
          const isMemberStart = memberStart === j.id
          const isSelected = selected.jointId === j.id
          const jointColor =
            j.support === 'pinned' ? '#7c3aed' : j.support === 'roller' ? '#0ea5e9' : '#0f172a'
          return (
            <g key={j.id}>
              {/* Load arrow */}
              {j.loadYkN !== 0 ? (
                <g>
                  <line
                    x1={j.x}
                    y1={j.y - 0.2}
                    x2={j.x}
                    y2={j.y + 0.9}
                    stroke="#ef4444"
                    strokeWidth={0.08}
                  />
                  <polygon
                    points={`${j.x - 0.18},${j.y + 0.9} ${j.x + 0.18},${j.y + 0.9} ${j.x},${j.y + 1.15}`}
                    fill="#ef4444"
                  />
                  <text x={j.x + 0.2} y={j.y + 0.2} fontSize={0.32} fill="#ef4444">
                    {j.loadYkN.toFixed(2)} kN
                  </text>
                </g>
              ) : null}

              <circle
                cx={j.x}
                cy={j.y}
                r={0.18}
                fill={isMemberStart ? '#fde68a' : 'white'}
                stroke={isSelected ? '#f59e0b' : jointColor}
                strokeWidth={0.08}
                onPointerDown={onJointPointerDown(j.id)}
                onClick={onJointClick(j.id)}
              />
              <text x={j.x + 0.25} y={j.y - 0.25} fontSize={0.35} fill="#0f172a">
                {jointLabelById.get(j.id) ?? '?'} ({j.x.toFixed(1)}, {j.y.toFixed(1)})
              </text>
            </g>
          )
        })}
      </svg>

      <div className="absolute bottom-2 left-2 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow-sm">
        Tool: <span className="font-semibold">{tool}</span>
        {tool === 'member' && memberStart ? (
          <span className="ml-2 text-slate-500">
            pick second joint (start={jointLabelById.get(memberStart)})
          </span>
        ) : null}
        <button
          type="button"
          className="ml-3 text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2"
          onClick={exportSvg}
        >
          Export SVG
        </button>
      </div>
    </div>
  )
}

