import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToolsPanel } from './components/ToolsPanel'
import { StatsPanel } from './components/StatsPanel'
import { TrussCanvas } from './components/TrussCanvas'
import type { ToolMode, Truss } from './truss/types'
import { indexToLabel } from './truss/labels'
import { computeCost } from './truss/cost'
import { computeConstraints } from './truss/constraints'
import { analyzeTruss } from './truss/solver'
import { autoAddMembers } from './truss/autoMembers'

function App() {
  const [tool, setTool] = useState<ToolMode>('joint')
  const [gridStepM, setGridStepM] = useState(0.5)
  const [selected, setSelected] = useState<{ jointId: string | null; memberId: string | null }>({
    jointId: null,
    memberId: null,
  })
  const pastRef = useRef<Truss[]>([])
  const futureRef = useRef<Truss[]>([])
  const [, forceHistoryRender] = useState(0)
  const [truss, setTrussRaw] = useState<Truss>({
    joints: [],
    members: [],
    pylonHeightM: 0,
  })

  const normalizeTruss = (next: Truss): Truss => ({
    ...next,
    joints: next.joints.map((j, i) => ({ ...j, label: indexToLabel(i) })),
  })

  const setTrussTransient = (next: Truss) => {
    // Normalize joint labels (A, B, C...) based on current order.
    setTrussRaw(normalizeTruss(next))
  }

  const commitTruss = useCallback(
    (next: Truss) => {
      pastRef.current.push(truss)
      if (pastRef.current.length > 100) pastRef.current.shift()
      futureRef.current = []
      setTrussRaw(normalizeTruss(next))
      forceHistoryRender((x) => x + 1)
    },
    [truss],
  )

  const commitTrussFrom = useCallback((prev: Truss, next: Truss) => {
    pastRef.current.push(prev)
    if (pastRef.current.length > 100) pastRef.current.shift()
    futureRef.current = []
    setTrussRaw(normalizeTruss(next))
    forceHistoryRender((x) => x + 1)
  }, [])

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(truss)
    setSelected({ jointId: null, memberId: null })
    setTrussRaw(normalizeTruss(prev))
    forceHistoryRender((x) => x + 1)
  }, [truss])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(truss)
    setSelected({ jointId: null, memberId: null })
    setTrussRaw(normalizeTruss(next))
    forceHistoryRender((x) => x + 1)
  }, [truss])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  const deleteSelected = useCallback(() => {
    if (selected.jointId) {
      const id = selected.jointId
      setSelected({ jointId: null, memberId: null })
      commitTruss({
        ...truss,
        joints: truss.joints.filter((j) => j.id !== id),
        members: truss.members.filter((m) => m.a !== id && m.b !== id),
      })
      return
    }
    if (selected.memberId) {
      const id = selected.memberId
      setSelected({ jointId: null, memberId: null })
      commitTruss({ ...truss, members: truss.members.filter((m) => m.id !== id) })
    }
  }, [commitTruss, selected.jointId, selected.memberId, truss])

  const cost = useMemo(() => computeCost(truss), [truss])
  const analysis = useMemo(() => analyzeTruss(truss), [truss])
  const constraints = useMemo(() => {
    const base = computeConstraints(truss)
    if (!analysis.ok) return base
    const tooHigh = analysis.memberForces.filter((f) => Math.abs(f.forcekN) > 12.0000001)
    return {
      ...base,
      results: [
        ...base.results,
        {
          id: 'member-force',
          label: 'Member force ≤ 12 kN',
          ok: tooHigh.length === 0,
          details: tooHigh.length === 0 ? undefined : `${tooHigh.length} member(s) exceed 12 kN`,
        },
      ],
    }
  }, [truss, analysis])

  const exportJson = () => {
    const text = JSON.stringify(truss, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'truss-builder.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSvg = () => {
    // Canvas registers a helper for MVP simplicity.
    ;(window as any).__TRUSS_EXPORT_SVG__?.()
  }

  const exportPng = () => {
    ;(window as any).__TRUSS_EXPORT_PNG__?.()
  }

  const autoMembers = () => {
    const res = autoAddMembers(truss)
    commitTruss(res.truss)
    window.setTimeout(() => window.alert(res.message), 0)
  }

  const clearAll = () => {
    commitTruss({
      joints: [],
      members: [],
      pylonHeightM: truss.pylonHeightM,
    })
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full min-h-0">
        <ToolsPanel
          tool={tool}
          setTool={setTool}
          gridStepM={gridStepM}
          setGridStepM={setGridStepM}
          truss={truss}
          setPylonHeightM={(n) =>
            commitTruss({ ...truss, pylonHeightM: Math.max(0, n || 0) })
          }
          exportJson={exportJson}
          exportSvg={exportSvg}
          exportPng={exportPng}
          autoMembers={autoMembers}
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          clearAll={clearAll}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          <TrussCanvas
            truss={truss}
            setTruss={commitTruss}
            commitTrussFrom={commitTrussFrom}
            setTrussTransient={setTrussTransient}
            tool={tool}
            gridStepM={gridStepM}
            analysis={analysis}
            constraints={constraints}
            selected={selected}
            setSelected={setSelected}
            deleteSelected={deleteSelected}
          />
        </div>

        <StatsPanel
          truss={truss}
          cost={cost}
          constraints={constraints}
          analysis={analysis}
          selected={selected}
          deleteSelected={deleteSelected}
        />
      </div>
    </div>
  )
}

export default App
