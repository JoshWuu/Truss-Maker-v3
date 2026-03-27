import type { AnalysisResult, Truss } from '../truss/types'
import type { PrecisionLevel } from '../truss/precision'
import { formatDistance, formatForce, formatCoordinate } from '../truss/precision'
import { memberLengthM } from '../truss/geometry'

export function MathPanel(props: {
  truss: Truss
  analysis: AnalysisResult
  precision?: PrecisionLevel
}) {
  const { truss, analysis, precision = 3 } = props

  const memberById = new Map(truss.members.map((m) => [m.id, m]))
  const jointById = new Map(truss.joints.map((j) => [j.id, j]))

  const sectionLabel = 'text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2'
  const monoRow = 'font-mono text-xs text-slate-700 leading-relaxed'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-4 overflow-x-hidden">

      <div>
        <div className={sectionLabel}>Member Lengths</div>
        {truss.members.length === 0 ? (
          <p className="text-slate-400 text-xs">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {truss.members.map((member) => {
              const ja = jointById.get(member.a)
              const jb = jointById.get(member.b)
              if (!ja || !jb) return null
              const length = memberLengthM(truss, member)
              const dx = jb.x - ja.x
              const dy = jb.y - ja.y
              return (
                <div key={member.id} className={monoRow}>
                  <span className="font-semibold text-slate-900">{ja.label}–{jb.label}</span>
                  {' = '}√(({formatCoordinate(jb.x, precision)}−{formatCoordinate(ja.x, precision)})²
                  {' + '}({formatCoordinate(jb.y, precision)}−{formatCoordinate(ja.y, precision)})²)
                  <br />
                  <span className="pl-4">
                    = √({formatDistance(dx * dx, 2)} + {formatDistance(dy * dy, 2)})
                  </span>
                  <br />
                  <span className="pl-4 font-semibold text-slate-900">
                    = {formatDistance(length, precision)} m
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {analysis.ok && (
        <div>
          <div className={sectionLabel}>Support Reactions</div>
          <div className="space-y-1">
            {Object.entries(analysis.reactions).map(([jointId, reaction]) => {
              const joint = jointById.get(jointId)
              if (!joint || joint.support === 'none') return null
              const hasRx = reaction.rxkN !== undefined && reaction.rxkN !== 0
              const hasRy = reaction.rykN !== undefined && reaction.rykN !== 0
              if (!hasRx && !hasRy) return null
              return (
                <div key={jointId} className={monoRow}>
                  <span className="font-semibold text-slate-900">Joint {joint.label}:</span>
                  {hasRx && <> R<sub>x</sub> = {formatForce(reaction.rxkN ?? 0)} kN</>}
                  {hasRx && hasRy && <span className="text-slate-400"> · </span>}
                  {hasRy && <> R<sub>y</sub> = {formatForce(reaction.rykN ?? 0)} kN</>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {analysis.ok ? (
        <div>
          <div className={sectionLabel}>Member Forces</div>
          <div className="space-y-1">
            {analysis.memberForces.map((force) => {
              const member = memberById.get(force.memberId)
              if (!member) return null
              const ja = jointById.get(member.a)
              const jb = jointById.get(member.b)
              if (!ja || !jb) return null
              const forceType = force.forcekN >= 0 ? 'T' : 'C'
              const color = force.forcekN >= 0 ? 'text-blue-700' : 'text-emerald-700'
              return (
                <div key={force.memberId} className={monoRow}>
                  <span className="font-semibold text-slate-900">{ja.label}–{jb.label}</span>
                  {': '}
                  <span className={color}>
                    {formatForce(force.forcekN)} kN ({forceType})
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-slate-400">{analysis.reason}</div>
      )}
    </div>
  )
}
