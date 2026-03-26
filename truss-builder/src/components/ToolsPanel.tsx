import { Button } from './Button'
import type { ToolMode, Truss } from '../truss/types'

export function ToolsPanel(props: {
  tool: ToolMode
  setTool: (t: ToolMode) => void
  gridStepM: number
  setGridStepM: (n: number) => void
  truss: Truss
  setPylonHeightM: (n: number) => void
  exportJson: () => void
  exportSvg: () => void
  exportPng: () => void
  autoMembers: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearAll: () => void
}) {
  const {
    tool,
    setTool,
    gridStepM,
    setGridStepM,
    truss,
    setPylonHeightM,
    exportJson,
    exportSvg,
    exportPng,
    autoMembers,
    undo,
    redo,
    canUndo,
    canRedo,
    clearAll,
  } = props

  return (
    <div className="h-full w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">Truss Builder</div>
        <div className="text-xs text-slate-500">MTE119 MVP</div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tools
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!canUndo} onClick={undo}>
            Undo
          </Button>
          <Button disabled={!canRedo} onClick={redo}>
            Redo
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button active={tool === 'select'} onClick={() => setTool('select')}>
            Select
          </Button>
          <Button active={tool === 'joint'} onClick={() => setTool('joint')}>
            Add joint
          </Button>
          <Button active={tool === 'member'} onClick={() => setTool('member')}>
            Add member
          </Button>
          <Button active={tool === 'support'} onClick={() => setTool('support')}>
            Support
          </Button>
          <Button active={tool === 'load'} onClick={() => setTool('load')}>
            Load
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          - **Select tool**: click a joint/member, then delete.
          <br />
          - **Drag**: drag joints to reposition (snaps to grid).
          <br />
          - **Pan/zoom**: drag background to pan, mousewheel to zoom.
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Grid
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button active={gridStepM === 0.0000001} onClick={() => setGridStepM(0.0000001)}>
            0.0000001 m
          </Button>
          <Button active={gridStepM === 0.25} onClick={() => setGridStepM(0.25)}>
           ur gay
          </Button>
          <Button active={gridStepM === 0.5} onClick={() => setGridStepM(0.5)}>
            0.5 m
          </Button>
          <Button active={gridStepM === 1} onClick={() => setGridStepM(1)}>
            1.0 m
          </Button>
        </div>
        <Button className="w-full" onClick={autoMembers}>
          Auto add members
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cost inputs
        </div>
        <label className="block text-xs text-slate-600">
          Pylon height (m)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            type="number"
            min={0}
            step={0.1}
            value={truss.pylonHeightM}
            onChange={(e) => setPylonHeightM(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Export
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={exportJson}>JSON</Button>
          <Button onClick={exportSvg}>SVG</Button>
          <Button onClick={exportPng}>PNG</Button>
        </div>
        <Button className="w-full" onClick={clearAll}>
          Clear all
        </Button>
      </div>
    </div>
  )
}

