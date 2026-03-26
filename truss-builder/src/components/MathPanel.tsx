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

  return (
    <div className="h-full max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="mb-3 font-semibold text-slate-900">Mathematical Analysis</div>

      {/* Member Lengths Section */}
      <div className="mb-4">
        <div className="mb-2 font-semibold text-slate-800">Member Lengths</div>
        <div className="space-y-1 font-mono text-slate-700">
          {truss.members.map((member) => {
            const ja = jointById.get(member.a)
            const jb = jointById.get(member.b)
            if (!ja || !jb) return null

            const length = memberLengthM(truss, member)
            const dx = jb.x - ja.x
            const dy = jb.y - ja.y

            return (
              <div key={member.id} className="break-words">
                <strong>
                  {ja.label}-{jb.label}
                </strong>{' '}
                = √((
                {formatCoordinate(jb.x, precision)} - {formatCoordinate(ja.x, precision)})² + (
                {formatCoordinate(jb.y, precision)} - {formatCoordinate(ja.y, precision)})²)
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;= √({formatDistance(dx * dx, 2)}² + {formatDistance(dy * dy, 2)}²)
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;= <strong>{formatDistance(length, precision)} m</strong>
              </div>
            )
          })}
        </div>
      </div>

      {/* Support Reactions Section */}
      {analysis.ok ? (
        <div className="mb-4">
          <div className="mb-2 font-semibold text-slate-800">Support Reactions</div>
          <div className="space-y-1 font-mono text-slate-700">
            {Object.entries(analysis.reactions).map(([jointId, reaction]) => {
              const joint = jointById.get(jointId)
              if (!joint || joint.support === 'none') return null

              const hasRx = reaction.rxkN !== undefined && reaction.rxkN !== 0
              const hasRy = reaction.rykN !== undefined && reaction.rykN !== 0

              if (!hasRx && !hasRy) return null

              return (
                <div key={jointId}>
                  <strong>Joint {joint.label}:</strong>
                  {hasRx && (
                    <>
                      {' '}
                      R<sub>x</sub> = {formatForce(reaction.rxkN ?? 0)} kN
                    </>
                  )}
                  {hasRx && hasRy && <> | </>}
                  {hasRy && (
                    <>
                      {' '}
                      R<sub>y</sub> = {formatForce(reaction.rykN ?? 0)} kN
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Member Forces Section */}
      {analysis.ok ? (
        <div>
          <div className="mb-2 font-semibold text-slate-800">Member Forces (Method of Joints)</div>
          <div className="space-y-1 font-mono text-slate-700">
            {analysis.memberForces.map((force) => {
              const member = memberById.get(force.memberId)
              if (!member) return null

              const ja = jointById.get(member.a)
              const jb = jointById.get(member.b)
              if (!ja || !jb) return null

              const forceType = force.forcekN >= 0 ? 'Tension' : 'Compression'

              return (
                <div key={force.memberId}>
                  <strong>
                    {ja.label}-{jb.label}
                  </strong>
                  : {formatForce(force.forcekN)} kN ({forceType})
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-slate-600">{analysis.reason}</div>
      )}
    </div>
  )
}
