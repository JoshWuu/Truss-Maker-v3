import type { Truss } from './types'
import { memberLengthM } from './geometry'

export type ConstraintResult = {
  id: string
  label: string
  ok: boolean
  details?: string
}

export type ConstraintSummary = {
  results: ConstraintResult[]
  allOk: boolean
}

function supportSystemOk(truss: Truss): { ok: boolean; details?: string } {
  const pinned = truss.joints.filter((j) => j.support === 'pinned')
  const rollerY = truss.joints.filter((j) => j.support === 'roller' || j.support === 'roller-up')
  const rollerX = truss.joints.filter((j) => j.support === 'roller-x' || j.support === 'roller-left')
  const rollerCount = rollerY.length + rollerX.length

  if (pinned.length === 0 && rollerCount === 0) {
    return { ok: false, details: 'Add one pinned and one roller support.' }
  }
  if (pinned.length !== 1 || rollerCount !== 1) {
    return { ok: false, details: 'Need exactly 1 pinned + 1 roller support.' }
  }
  const rollerJoint = rollerY[0] ?? rollerX[0]
  if (pinned[0]!.id === rollerJoint!.id) {
    return { ok: false, details: 'Pinned and roller must be on different joints.' }
  }
  return { ok: true }
}

export function computeConstraints(truss: Truss): ConstraintSummary {
  const results: ConstraintResult[] = []

  // Member length
  const tooLong = truss.members
    .map((m) => ({ id: m.id, len: memberLengthM(truss, m) }))
    .filter((x) => Number.isFinite(x.len) && x.len > 3.0000001)

  results.push({
    id: 'member-length',
    label: 'Member length ≤ 3.0 m',
    ok: tooLong.length === 0,
    details:
      tooLong.length === 0
        ? undefined
        : `${tooLong.length} member(s) exceed 3.0 m`,
  })

  // Determinacy (classic planar, r=3)
  const n = truss.joints.length
  const m = truss.members.length
  results.push({
    id: 'determinacy',
    label: 'Determinacy: m = 2n − 3',
    ok: m === 2 * n - 3,
    details: `n=${n}, m=${m}, 2n−3=${2 * n - 3}`,
  })

  // Support system
  const sup = supportSystemOk(truss)
  results.push({
    id: 'supports',
    label: 'Valid support system',
    ok: sup.ok,
    details: sup.details,
  })

  return {
    results,
    allOk: results.every((r) => r.ok),
  }
}

