import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToolsPanel } from './components/ToolsPanel'
import { StatsPanel } from './components/StatsPanel'
import { TrussCanvas } from './components/TrussCanvas'
import { WelcomeModal } from './components/WelcomeModal'
import type { CostRates, ToolMode, Truss } from './truss/types'
import { DEFAULT_COST_RATES } from './truss/types'
import type { StepSize, PrecisionLevel } from './truss/precision'
import { indexToLabel } from './truss/labels'
import { computeCost } from './truss/cost'
import { computeConstraints } from './truss/constraints'
import { analyzeTruss } from './truss/solver'
import { autoAddMembers } from './truss/autoMembers'
import { roundToStep } from './truss/precision'
import { downloadCalculations } from './truss/export'
import { exportLatexReport } from './truss/latex'
import type { TrussPreset } from './truss/presets'
import {
  IconCursor,
  IconCircleDot,
  IconLine,
  IconTriangleSupport,
  IconArrowDown,
  IconUndo,
  IconRedo,
  IconBarChart,
  IconMenu,
  IconSettings,
} from './components/icons'

// ─── Cost rates floating widget ──────────────────────────────────────────────

function CostRatesWidget(props: { costRates: CostRates; setCostRates: (r: CostRates) => void }) {
  const { costRates, setCostRates } = props
  const [open, setOpen] = useState(false)

  const rates: { key: keyof CostRates; label: string }[] = [
    { key: 'memberPerM', label: 'Member ($/m)' },
    { key: 'perJoint',   label: 'Joint ($ each)' },
    { key: 'pylonPerM',  label: 'Pylon ($/m)' },
    { key: 'perRope',    label: 'Rope ($ each)' },
  ]

  return (
    <div className="absolute bottom-[5.5rem] right-3 lg:bottom-10 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-2 w-52">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Rates ($ per unit)
          </p>
          {rates.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <span className="shrink-0">{label}</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={costRates[key]}
                onChange={(e) =>
                  setCostRates({ ...costRates, [key]: Math.max(0, Number(e.target.value)) })
                }
                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm font-mono text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'rounded-xl border p-2 shadow-sm transition-colors [touch-action:manipulation]',
          open
            ? 'border-indigo-300 bg-indigo-600 text-white'
            : 'border-slate-200 bg-white/95 text-slate-500 backdrop-blur-sm hover:bg-slate-50',
        ].join(' ')}
      >
        <IconSettings className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Mobile toolbar ──────────────────────────────────────────────────────────

type MobilePanel = 'tools' | 'stats' | null

const MOBILE_TOOLS: { mode: ToolMode; label: string; icon: ReactNode }[] = [
  { mode: 'select',  label: 'Select',  icon: <IconCursor           className="h-5 w-5" /> },
  { mode: 'joint',   label: 'Joint',   icon: <IconCircleDot        className="h-5 w-5" /> },
  { mode: 'member',  label: 'Member',  icon: <IconLine             className="h-5 w-5" /> },
  { mode: 'support', label: 'Support', icon: <IconTriangleSupport  className="h-5 w-5" /> },
  { mode: 'load',    label: 'Load',    icon: <IconArrowDown        className="h-5 w-5" /> },
]

function MobileToolbar(props: {
  tool: ToolMode
  setTool: (t: ToolMode) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  mobilePanel: MobilePanel
  setMobilePanel: (p: MobilePanel) => void
}) {
  const { tool, setTool, canUndo, canRedo, undo, redo, mobilePanel, setMobilePanel } = props

  const iconBtn = (
    active: boolean,
    disabled: boolean,
    onClick: () => void,
    icon: ReactNode,
    label: string
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-1 rounded-lg [touch-action:manipulation] transition-colors',
        active ? 'text-indigo-600' : disabled ? 'text-slate-300' : 'text-slate-500 active:bg-slate-100',
      ].join(' ')}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  )

  return (
    <div className="flex h-14 items-stretch border-t border-slate-200 bg-white px-1 safe-area-inset-bottom">
      {iconBtn(!canUndo ? false : false, !canUndo, undo, <IconUndo className="h-5 w-5" />, 'Undo')}
      {iconBtn(false, !canRedo, redo, <IconRedo className="h-5 w-5" />, 'Redo')}

      <div className="mx-1 my-2 w-px bg-slate-200" />

      {MOBILE_TOOLS.map(({ mode, label, icon }) =>
        iconBtn(tool === mode, false, () => setTool(mode), icon, label)
      )}

      <div className="mx-1 my-2 w-px bg-slate-200" />

      {iconBtn(
        mobilePanel === 'stats', false,
        () => setMobilePanel(mobilePanel === 'stats' ? null : 'stats'),
        <IconBarChart className="h-5 w-5" />, 'Stats'
      )}
      {iconBtn(
        mobilePanel === 'tools', false,
        () => setMobilePanel(mobilePanel === 'tools' ? null : 'tools'),
        <IconMenu className="h-5 w-5" />, 'Tools'
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [tool, setTool] = useState<ToolMode>('joint')
  const [gridStepM, setGridStepM] = useState(0.5)
  const [moveStepM, setMoveStepM] = useState<StepSize>(0.1)
  const [precision, setPrecision] = useState<PrecisionLevel>(3)
  const [costRates, setCostRates] = useState<CostRates>(DEFAULT_COST_RATES)
  const [pdfStatus, setPdfStatus] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(() => localStorage.getItem('trussbuilder_seen_tutorial') !== '1')
  const [presetsForceOpen, setPresetsForceOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
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
      if (mod) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault()
          redo()
        }
      }

      if (selected.jointId && !mod) {
        const joint = truss.joints.find((j) => j.id === selected.jointId)
        if (!joint) return
        let dx = 0
        let dy = 0
        switch (e.key) {
          case 'ArrowLeft':  dx = -moveStepM; break
          case 'ArrowRight': dx =  moveStepM; break
          case 'ArrowUp':    dy = -moveStepM; break
          case 'ArrowDown':  dy =  moveStepM; break
          default: return
        }
        e.preventDefault()
        commitTrussFrom(truss, {
          ...truss,
          joints: truss.joints.map((j) =>
            j.id === selected.jointId
              ? { ...j, x: roundToStep(joint.x + dx, moveStepM), y: roundToStep(joint.y + dy, moveStepM) }
              : j
          ),
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo, selected.jointId, truss, moveStepM, commitTrussFrom])

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

  const addJoint = useCallback((x: number, y: number) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `j_${Date.now()}_${Math.random().toString(16).slice(2)}`
    commitTruss({
      ...truss,
      joints: [...truss.joints, { id, label: '?', x, y, support: 'none', loadYkN: 0 }],
    })
    setSelected({ jointId: id, memberId: null })
  }, [commitTruss, truss])

  const updateJointCoordinate = useCallback(
    (jointId: string, x: number, y: number) => {
      commitTrussFrom(truss, {
        ...truss,
        joints: truss.joints.map((j) => (j.id === jointId ? { ...j, x, y } : j)),
      })
    },
    [commitTrussFrom, truss]
  )

  const cost = useMemo(() => computeCost(truss, costRates), [truss, costRates])
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

  const exportSvg = () => { ;(window as any).__TRUSS_EXPORT_SVG__?.() }
  const exportPng = () => { ;(window as any).__TRUSS_EXPORT_PNG__?.() }

  const autoMembers = () => {
    const res = autoAddMembers(truss)
    commitTruss(res.truss)
    window.setTimeout(() => window.alert(res.message), 0)
  }

  const clearAll = () => {
    commitTruss({ joints: [], members: [], pylonHeightM: truss.pylonHeightM })
  }

  const loadPreset = useCallback((preset: TrussPreset) => {
    if (truss.joints.length > 0) {
      if (!window.confirm(`Load "${preset.name}"? This will replace your current design.`)) return
    }
    setSelected({ jointId: null, memberId: null })
    commitTruss(preset.build())
  }, [truss.joints.length, commitTruss])

  const dismissModal = () => {
    localStorage.setItem('trussbuilder_seen_tutorial', '1')
    setShowModal(false)
  }

  const handleStartPreset = () => {
    dismissModal()
    setPresetsForceOpen(true)
    setMobilePanel('tools')
  }

  const exportCalculations = () => {
    downloadCalculations(truss, analysis, precision)
  }

  const exportPdfLatex = async () => {
    setPdfStatus('Compiling PDF…')
    const result = await exportLatexReport({ truss, analysis, constraints, cost, costRates, precision })
    setPdfStatus(result.message)
    // Clear the status message after a few seconds (longer if it's a fallback message)
    const delay = result.ok ? 3000 : 12000
    setTimeout(() => setPdfStatus(null), delay)
  }

  // Shared panel props
  const toolsPanelProps = {
    tool, setTool, gridStepM, setGridStepM, moveStepM, setMoveStepM,
    truss, setPylonHeightM: (n: number) => commitTruss({ ...truss, pylonHeightM: Math.max(0, n || 0) }),
    exportJson, exportSvg, exportPng, exportCalculations, exportPdfLatex,
    autoMembers, undo, redo, canUndo, canRedo, clearAll,
    pdfStatus,
    onLoadPreset: loadPreset,
    presetsForceOpen,
    onReplayTutorial: () => setShowModal(true),
  }

  const statsPanelProps = {
    truss, cost, constraints, analysis, selected, deleteSelected,
    onUpdateJointCoordinate: updateJointCoordinate,
    onAddJoint: addJoint,
    precision, onPrecisionChange: setPrecision,
    costRates,
  }

  const canvasProps = {
    truss, setTruss: commitTruss, commitTrussFrom,
    setTrussTransient, tool, gridStepM, analysis, constraints,
    selected, setSelected, deleteSelected,
  }

  return (
    <>
    {showModal && (
      <WelcomeModal onStartPreset={handleStartPreset} onSkip={dismissModal} />
    )}
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full min-h-0">

        {/* ── Desktop: left panel ── */}
        <div className="hidden lg:block lg:w-72 lg:shrink-0 h-full border-r border-slate-200">
          <ToolsPanel {...toolsPanelProps} />
        </div>

        {/* ── Canvas + mobile overlays ── */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <TrussCanvas {...canvasProps} />

          {/* Mobile backdrop */}
          {mobilePanel !== null && (
            <div
              className="lg:hidden absolute inset-0 z-10 bg-black/20"
              onClick={() => setMobilePanel(null)}
            />
          )}

          {/* Mobile: tools bottom sheet */}
          {mobilePanel === 'tools' && (
            <div className="lg:hidden absolute inset-x-0 bottom-14 z-20 flex max-h-[72vh] flex-col rounded-t-2xl bg-white shadow-2xl overflow-hidden">
              <div className="flex shrink-0 justify-center py-2.5">
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <ToolsPanel {...toolsPanelProps} onClose={() => setMobilePanel(null)} />
              </div>
            </div>
          )}

          {/* Mobile: stats bottom sheet */}
          {mobilePanel === 'stats' && (
            <div className="lg:hidden absolute inset-x-0 bottom-14 z-20 flex max-h-[72vh] flex-col rounded-t-2xl bg-white shadow-2xl overflow-hidden">
              <div className="flex shrink-0 justify-center py-2.5">
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <StatsPanel {...statsPanelProps} onClose={() => setMobilePanel(null)} />
              </div>
            </div>
          )}

          {/* Cost rates floating widget */}
          <CostRatesWidget costRates={costRates} setCostRates={setCostRates} />

          {/* Mobile toolbar */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30">
            <MobileToolbar
              tool={tool}
              setTool={(t) => { setTool(t); setMobilePanel(null) }}
              canUndo={canUndo}
              canRedo={canRedo}
              undo={undo}
              redo={redo}
              mobilePanel={mobilePanel}
              setMobilePanel={setMobilePanel}
            />
          </div>
        </div>

        {/* ── Desktop: right panel ── */}
        <div className="hidden lg:block lg:w-80 lg:shrink-0 h-full border-l border-slate-200">
          <StatsPanel {...statsPanelProps} />
        </div>

      </div>
    </div>
    </>
  )
}

export default App
