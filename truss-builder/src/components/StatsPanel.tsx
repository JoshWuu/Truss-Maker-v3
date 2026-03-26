import type { AnalysisResult, Truss } from '../truss/types'
import type { CostBreakdown } from '../truss/cost'
import type { ConstraintSummary } from '../truss/constraints'
import { Button } from './Button'

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

export function StatsPanel(props: {
  truss: Truss
  cost: CostBreakdown
  constraints: ConstraintSummary
  analysis: AnalysisResult
  selected: { jointId: string | null; memberId: string | null }
  deleteSelected: () => void
}) {
  const { truss, cost, constraints, analysis, selected, deleteSelected } = props
  const n = truss.joints.length
  const m = truss.members.length
  const memberById = new Map(truss.members.map((mm) => [mm.id, mm]))
  const jointById = new Map(truss.joints.map((j) => [j.id, j]))

  return (
    <div className="h-full w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-semibold text-slate-900">Stats</div>

      <div className="mb-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Joints (n)</span>
          <span className="font-medium text-slate-900">{n}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Members (m)</span>
          <span className="font-medium text-slate-900">{m}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Total length</span>
          <span className="font-medium text-slate-900">
            {cost.totalMemberLengthM.toFixed(2)} m
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cost
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Members</span>
            <span className="font-medium text-slate-900">{money(cost.memberCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Joints</span>
            <span className="font-medium text-slate-900">{money(cost.jointCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Pylons</span>
            <span className="font-medium text-slate-900">{money(cost.pylonCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Ropes</span>
            <span className="font-medium text-slate-900">{money(cost.ropeCost)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="font-semibold text-slate-900">{money(cost.totalCost)}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Constraints
        </div>
        <div className="space-y-2">
          {constraints.results.map((r) => (
            <div key={r.id} className="rounded-md border border-slate-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-900">{r.label}</div>
                <div
                  className={[
                    'shrink-0 rounded px-2 py-0.5 text-xs font-semibold',
                    r.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                  ].join(' ')}
                >
                  {r.ok ? 'PASS' : 'FAIL'}
                </div>
              </div>
              {r.details ? <div className="mt-1 text-xs text-slate-500">{r.details}</div> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Selection
        </div>
        <div className="rounded-md border border-slate-200 p-2 text-xs text-slate-600">
          {selected.jointId ? (
            <div>
              Joint:{' '}
              <span className="font-semibold text-slate-900">
                {jointById.get(selected.jointId)?.label ?? selected.jointId}
              </span>
            </div>
          ) : selected.memberId ? (
            <div>
              Member:{' '}
              <span className="font-semibold text-slate-900">
                {(() => {
                  const mem = memberById.get(selected.memberId)
                  if (!mem) return selected.memberId
                  const a = jointById.get(mem.a)?.label ?? '?'
                  const b = jointById.get(mem.b)?.label ?? '?'
                  return `${a}-${b}`
                })()}
              </span>
            </div>
          ) : (
            <div>Nothing selected.</div>
          )}
          <div className="mt-2">
            <Button
              disabled={!selected.jointId && !selected.memberId}
              onClick={deleteSelected}
              className="w-full"
            >
              Delete selected
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Analysis (method of joints)
        </div>
        {analysis.ok ? (
          <div className="space-y-2">
            <div className="text-xs text-slate-600">Solved.</div>
            <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
              <table className="w-full table-fixed text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-1 text-left font-semibold text-slate-700">Member</th>
                    <th className="px-2 py-1 text-left font-semibold text-slate-700">Type</th>
                    <th className="px-2 py-1 text-right font-semibold text-slate-700">Force (kN)</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.memberForces.map((f) => {
                    const mem = memberById.get(f.memberId)
                    const a = mem ? jointById.get(mem.a)?.label ?? '?' : '?'
                    const b = mem ? jointById.get(mem.b)?.label ?? '?' : '?'
                    const type = f.forcekN >= 0 ? 'Tension' : 'Compression'
                    const tooHigh = Math.abs(f.forcekN) > 12.0000001
                    return (
                      <tr key={f.memberId} className="border-b border-slate-100">
                        <td className="px-2 py-1 text-slate-900">{a}-{b}</td>
                        <td
                          className={[
                            'px-2 py-1 font-medium',
                            tooHigh ? 'text-rose-700' : f.forcekN >= 0 ? 'text-blue-700' : 'text-emerald-700',
                          ].join(' ')}
                        >
                          {type}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-900">
                          {f.forcekN.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-600">{analysis.reason}</div>
        )}
      </div>
    </div>
  )
}

