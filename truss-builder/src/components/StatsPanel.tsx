import { useState } from 'react'
import type { AnalysisResult, CostRates, Truss } from '../truss/types'
import type { CostBreakdown } from '../truss/cost'
import type { ConstraintSummary } from '../truss/constraints'
import type { PrecisionLevel } from '../truss/precision'
import { PRECISION_LEVELS, formatCoordinate, parseCoordinate } from '../truss/precision'
import { Button } from './Button'
import { MathPanel } from './MathPanel'
import { IconX, IconChevronDown, IconTrash } from './icons'

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function SectionHeader({
  label,
  collapsed,
  onToggle,
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between py-0.5"
      onClick={onToggle}
    >
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <IconChevronDown
        className={`h-3 w-3 text-slate-400 transition-transform duration-150 ${
          collapsed ? '-rotate-90' : ''
        }`}
      />
    </button>
  )
}

function Divider() {
  return <div className="border-t border-slate-100" />
}

export function StatsPanel(props: {
  truss: Truss
  cost: CostBreakdown
  constraints: ConstraintSummary
  analysis: AnalysisResult
  selected: { jointId: string | null; memberId: string | null }
  deleteSelected: () => void
  onUpdateJointCoordinate?: (jointId: string, x: number, y: number) => void
  onAddJoint?: (x: number, y: number) => void
  precision?: PrecisionLevel
  onPrecisionChange?: (p: PrecisionLevel) => void
  onClose?: () => void
  costRates?: CostRates
}) {
  const {
    truss, cost, constraints, analysis, selected, deleteSelected,
    onUpdateJointCoordinate, onAddJoint,
    precision: precisionProp = 3, onPrecisionChange,
    onClose,
    costRates,
  } = props

  const [localEditX, setLocalEditX] = useState<string | null>(null)
  const [localEditY, setLocalEditY] = useState<string | null>(null)
  const [tableEdits, setTableEdits] = useState<Record<string, { x: string; y: string }>>({})
  const [newJointX, setNewJointX] = useState<string>(formatCoordinate(0, precisionProp))
  const [newJointY, setNewJointY] = useState<string>(formatCoordinate(0, precisionProp))
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    cost: false,
    constraints: false,
    joints: false,
    selection: false,
    analysis: false,
    math: true,
  })

  const precision = precisionProp
  const setPrecision = onPrecisionChange ?? (() => {})
  const n = truss.joints.length
  const m = truss.members.length
  const memberById = new Map(truss.members.map((mm) => [mm.id, mm]))
  const jointById = new Map(truss.joints.map((j) => [j.id, j]))

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100'
  const tableInputCls =
    'w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none'

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Analysis</div>
          <div className="text-[11px] text-slate-400">
            {n} joint{n !== 1 ? 's' : ''} · {m} member{m !== 1 ? 's' : ''} · {cost.totalMemberLengthM.toFixed(2)} m
          </div>
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
        {/* Precision */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Display Precision
          </label>
          <select
            value={precision}
            onChange={(e) => setPrecision(parseInt(e.target.value) as PrecisionLevel)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {PRECISION_LEVELS.map((p) => (
              <option key={p} value={p}>
                {p} decimal place{p !== 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <Divider />

        {/* Cost */}
        <div className="space-y-2">
          <SectionHeader label="Cost" collapsed={collapsed.cost} onToggle={() => toggle('cost')} />
          {!collapsed.cost && (
            <div className="space-y-1 text-sm">
              {[
                { label: 'Members', value: money(cost.memberCost), sub: `$${costRates?.memberPerM ?? 12}/m × ${cost.totalMemberLengthM.toFixed(2)} m` },
                { label: 'Joints',  value: money(cost.jointCost),  sub: `$${costRates?.perJoint  ?? 3} × ${n}` },
                { label: 'Pylons',  value: money(cost.pylonCost),  sub: `$${costRates?.pylonPerM ?? 12}/m × ${truss.pylonHeightM} m` },
                { label: 'Ropes',   value: money(cost.ropeCost),   sub: `$${costRates?.perRope   ?? 4} × ${cost.ropeCount}` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-600">{label}</span>
                    {sub && <span className="ml-1.5 text-[11px] text-slate-400">{sub}</span>}
                  </div>
                  <span className="font-medium tabular-nums text-slate-900">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-base font-bold tabular-nums text-slate-900">
                  {money(cost.totalCost)}
                </span>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Constraints */}
        <div className="space-y-2">
          <SectionHeader label="Constraints" collapsed={collapsed.constraints} onToggle={() => toggle('constraints')} />
          {!collapsed.constraints && (
            <div className="space-y-2">
              {constraints.results.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700">{r.label}</div>
                    {r.details && <div className="mt-0.5 text-[11px] text-slate-500">{r.details}</div>}
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                      r.ok
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
                    ].join(' ')}
                  >
                    {r.ok ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Joints table */}
        <div className="space-y-2">
          <SectionHeader label="Joints" collapsed={collapsed.joints} onToggle={() => toggle('joints')} />
          {!collapsed.joints && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Joint</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">X (m)</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Y (m)</th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {truss.joints.map((joint) => {
                    const rowDraft = tableEdits[joint.id] || {
                      x: formatCoordinate(joint.x, precision),
                      y: formatCoordinate(joint.y, precision),
                    }
                    const commitCoordinate = (newX: string, newY: string) => {
                      const parsedX = parseCoordinate(newX)
                      const parsedY = parseCoordinate(newY)
                      if (!onUpdateJointCoordinate || parsedX === null || parsedY === null) return
                      onUpdateJointCoordinate(joint.id, parsedX, parsedY)
                      setTableEdits((prev) => {
                        const next = { ...prev }
                        delete next[joint.id]
                        return next
                      })
                    }
                    return (
                      <tr key={joint.id}>
                        <td className="px-2 py-1.5 font-medium text-slate-700">{joint.label}</td>
                        <td className="px-2 py-1">
                          <input
                            className={tableInputCls}
                            value={rowDraft.x}
                            onChange={(e) =>
                              setTableEdits((prev) => ({
                                ...prev,
                                [joint.id]: { ...rowDraft, x: e.target.value },
                              }))
                            }
                            onBlur={(e) => commitCoordinate(e.target.value, rowDraft.y)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitCoordinate(e.currentTarget.value, rowDraft.y)
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className={tableInputCls}
                            value={rowDraft.y}
                            onChange={(e) =>
                              setTableEdits((prev) => ({
                                ...prev,
                                [joint.id]: { ...rowDraft, y: e.target.value },
                              }))
                            }
                            onBlur={(e) => commitCoordinate(rowDraft.x, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitCoordinate(rowDraft.x, e.currentTarget.value)
                            }}
                          />
                        </td>
                        <td className="px-2 py-1.5 capitalize text-slate-500">{joint.support}</td>
                      </tr>
                    )
                  })}
                  {/* Add new joint row */}
                  <tr className="bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-400">New</td>
                    <td className="px-2 py-1">
                      <input
                        className={tableInputCls}
                        value={newJointX}
                        onChange={(e) => setNewJointX(e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={tableInputCls}
                        value={newJointY}
                        onChange={(e) => setNewJointY(e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 [touch-action:manipulation]"
                        onClick={() => {
                          if (!onAddJoint) return
                          const parsedX = parseCoordinate(newJointX)
                          const parsedY = parseCoordinate(newJointY)
                          if (parsedX === null || parsedY === null) return
                          onAddJoint(parsedX, parsedY)
                          setNewJointX(formatCoordinate(0, precision))
                          setNewJointY(formatCoordinate(0, precision))
                        }}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selection */}
        {(selected.jointId || selected.memberId) && (
          <>
            <Divider />
            <div className="space-y-2">
              <SectionHeader label="Selection" collapsed={collapsed.selection} onToggle={() => toggle('selection')} />
              {!collapsed.selection && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {selected.jointId ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700">
                        Joint{' '}
                        <span className="text-indigo-600">
                          {jointById.get(selected.jointId)?.label ?? selected.jointId}
                        </span>
                      </div>
                      {(() => {
                        const joint = jointById.get(selected.jointId)
                        if (!joint) return null
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="w-4 shrink-0 text-xs font-medium text-slate-600">X</label>
                              <input
                                type="text"
                                value={localEditX !== null ? localEditX : formatCoordinate(joint.x, precision)}
                                onChange={(e) => setLocalEditX(e.target.value)}
                                onBlur={(e) => {
                                  const parsed = parseCoordinate(e.target.value)
                                  if (parsed !== null && onUpdateJointCoordinate && selected.jointId) {
                                    onUpdateJointCoordinate(selected.jointId, parsed, joint.y)
                                  }
                                  setLocalEditX(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const parsed = parseCoordinate(e.currentTarget.value)
                                    if (parsed !== null && onUpdateJointCoordinate && selected.jointId) {
                                      onUpdateJointCoordinate(selected.jointId, parsed, joint.y)
                                    }
                                    setLocalEditX(null)
                                  } else if (e.key === 'Escape') {
                                    setLocalEditX(null)
                                  }
                                }}
                                className={inputCls + ' font-mono'}
                              />
                              <span className="shrink-0 text-xs text-slate-400">m</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="w-4 shrink-0 text-xs font-medium text-slate-600">Y</label>
                              <input
                                type="text"
                                value={localEditY !== null ? localEditY : formatCoordinate(joint.y, precision)}
                                onChange={(e) => setLocalEditY(e.target.value)}
                                onBlur={(e) => {
                                  const parsed = parseCoordinate(e.target.value)
                                  if (parsed !== null && onUpdateJointCoordinate && selected.jointId) {
                                    onUpdateJointCoordinate(selected.jointId, joint.x, parsed)
                                  }
                                  setLocalEditY(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const parsed = parseCoordinate(e.currentTarget.value)
                                    if (parsed !== null && onUpdateJointCoordinate && selected.jointId) {
                                      onUpdateJointCoordinate(selected.jointId, joint.x, parsed)
                                    }
                                    setLocalEditY(null)
                                  } else if (e.key === 'Escape') {
                                    setLocalEditY(null)
                                  }
                                }}
                                className={inputCls + ' font-mono'}
                              />
                              <span className="shrink-0 text-xs text-slate-400">m</span>
                            </div>
                          </div>
                        )
                      })()}
                      <Button variant="danger" onClick={deleteSelected} className="w-full">
                        <IconTrash className="h-4 w-4" /> Delete Joint
                      </Button>
                    </div>
                  ) : selected.memberId ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700">
                        Member{' '}
                        <span className="text-indigo-600">
                          {(() => {
                            const mem = memberById.get(selected.memberId!)
                            if (!mem) return selected.memberId
                            const a = jointById.get(mem.a)?.label ?? '?'
                            const b = jointById.get(mem.b)?.label ?? '?'
                            return `${a}–${b}`
                          })()}
                        </span>
                      </div>
                      <Button variant="danger" onClick={deleteSelected} className="w-full">
                        <IconTrash className="h-4 w-4" /> Delete Member
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}

        <Divider />

        {/* Analysis results */}
        <div className="space-y-2">
          <SectionHeader label="Analysis" collapsed={collapsed.analysis} onToggle={() => toggle('analysis')} />
          {!collapsed.analysis && (
            analysis.ok ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Member</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Force (kN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.memberForces.map((f) => {
                      const mem = memberById.get(f.memberId)
                      const a = mem ? jointById.get(mem.a)?.label ?? '?' : '?'
                      const b = mem ? jointById.get(mem.b)?.label ?? '?' : '?'
                      const isTension = f.forcekN >= 0
                      const tooHigh = Math.abs(f.forcekN) > 12.0000001
                      return (
                        <tr key={f.memberId}>
                          <td className="px-3 py-2 font-medium text-slate-800">{a}–{b}</td>
                          <td
                            className={[
                              'px-3 py-2 font-medium',
                              tooHigh
                                ? 'text-rose-600'
                                : isTension
                                ? 'text-blue-600'
                                : 'text-emerald-600',
                            ].join(' ')}
                          >
                            {isTension ? 'Tension' : 'Compression'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-800">
                            {f.forcekN.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">{analysis.reason}</p>
            )
          )}
        </div>

        <Divider />

        {/* Mathematics */}
        <div className="space-y-2">
          <SectionHeader label="Mathematics" collapsed={collapsed.math} onToggle={() => toggle('math')} />
          {!collapsed.math && (
            <MathPanel truss={truss} analysis={analysis} precision={precision} />
          )}
        </div>
      </div>
    </div>
  )
}
