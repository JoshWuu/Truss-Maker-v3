import { Button } from './Button'
import type { ToolMode, Truss } from '../truss/types'
import type { StepSize } from '../truss/precision'
import { STEP_SIZES } from '../truss/precision'
import {
  IconCursor,
  IconCircleDot,
  IconLine,
  IconTriangleSupport,
  IconArrowDown,
  IconUndo,
  IconRedo,
  IconWand,
  IconDownload,
  IconTrash,
  IconX,
} from './icons'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="border-t border-slate-100" />
}

const TOOL_CONFIG: { mode: ToolMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'select', label: 'Select', icon: <IconCursor className="w-4 h-4" /> },
  { mode: 'joint', label: 'Joint', icon: <IconCircleDot className="w-4 h-4" /> },
  { mode: 'member', label: 'Member', icon: <IconLine className="w-4 h-4" /> },
  { mode: 'support', label: 'Support', icon: <IconTriangleSupport className="w-4 h-4" /> },
  { mode: 'load', label: 'Load', icon: <IconArrowDown className="w-4 h-4" /> },
]

const GRID_OPTIONS: { value: number; label: string }[] = [
  { value: 0.0000001, label: 'Free' },
  { value: 0.25, label: '0.25 m' },
  { value: 0.5, label: '0.5 m' },
  { value: 1, label: '1.0 m' },
]

export function ToolsPanel(props: {
  tool: ToolMode
  setTool: (t: ToolMode) => void
  gridStepM: number
  setGridStepM: (n: number) => void
  moveStepM: StepSize
  setMoveStepM: (n: StepSize) => void
  truss: Truss
  setPylonHeightM: (n: number) => void
  exportJson: () => void
  exportSvg: () => void
  exportPng: () => void
  exportCalculations: () => void
  exportPdfLatex: () => void
  autoMembers: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearAll: () => void
  pdfStatus: string | null
  onClose?: () => void
}) {
  const {
    tool, setTool, gridStepM, setGridStepM, moveStepM, setMoveStepM,
    truss, setPylonHeightM, exportJson, exportSvg, exportPng,
    exportCalculations, exportPdfLatex, autoMembers, undo, redo, canUndo, canRedo,
    clearAll, pdfStatus, onClose,
  } = props

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Truss Builder</div>
          <div className="text-[11px] text-slate-400">built by Waterloo students for Waterloo students</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* History */}
        <div className="space-y-2">
          <SectionLabel>History</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!canUndo} onClick={undo}>
              <IconUndo className="h-4 w-4" /> Undo
            </Button>
            <Button disabled={!canRedo} onClick={redo}>
              <IconRedo className="h-4 w-4" /> Redo
            </Button>
          </div>
        </div>

        <Divider />

        {/* Tools */}
        <div className="space-y-2">
          <SectionLabel>Tools</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {TOOL_CONFIG.map(({ mode, label, icon }) => (
              <Button key={mode} active={tool === mode} onClick={() => setTool(mode)}>
                {icon} {label}
              </Button>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 space-y-1 leading-relaxed">
            <div><strong className="font-semibold text-slate-600">Select</strong> — click joint or member to select, then delete</div>
            <div><strong className="font-semibold text-slate-600">Drag</strong> — drag joints to reposition (snaps to grid)</div>
            <div><strong className="font-semibold text-slate-600">Pan / Zoom</strong> — drag background · scroll wheel · pinch</div>
          </div>
        </div>

        <Divider />

        {/* Grid snap */}
        <div className="space-y-2">
          <SectionLabel>Grid Snap</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {GRID_OPTIONS.map(({ value, label }) => (
              <Button key={value} active={gridStepM === value} onClick={() => setGridStepM(value)}>
                {label}
              </Button>
            ))}
          </div>
          <Button className="w-full" onClick={autoMembers}>
            <IconWand className="h-4 w-4" /> Auto Add Members
          </Button>
        </div>

        <Divider />

        {/* Arrow key step */}
        <div className="space-y-2">
          <SectionLabel>Arrow Key Step</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {STEP_SIZES.map((step) => (
              <Button key={step} active={moveStepM === step} onClick={() => setMoveStepM(step)}>
                {step} m
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Select a joint then use arrow keys to nudge it precisely.
          </p>
        </div>

        <Divider />

        {/* Cost inputs */}
        <div className="space-y-2">
          <SectionLabel>Cost Inputs</SectionLabel>

          {/* Pylon height */}
          <label className="block text-xs font-medium text-slate-600">
            Pylon height (m)
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              type="number"
              min={0}
              step={0.1}
              value={truss.pylonHeightM}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPylonHeightM(Number(e.target.value))}
            />
          </label>

        </div>

        <Divider />

        {/* Export */}
        <div className="space-y-2">
          <SectionLabel>Export</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={exportJson}>JSON</Button>
            <Button onClick={exportSvg}>SVG</Button>
            <Button onClick={exportPng}>PNG</Button>
          </div>
          <Button className="w-full" onClick={exportCalculations}>
            <IconDownload className="h-4 w-4" /> Export Calculations
          </Button>

          {/* PDF / LaTeX export */}
          <Button className="w-full" onClick={exportPdfLatex}>
            <IconDownload className="h-4 w-4" /> Export as PDF (LaTeX)
          </Button>
          {pdfStatus && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 whitespace-pre-wrap">
              {pdfStatus}
            </div>
          )}

          <Button className="w-full" variant="danger" onClick={clearAll}>
            <IconTrash className="h-4 w-4" /> Clear All
          </Button>
        </div>
      </div>
    </div>
  )
}
