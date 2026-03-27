import type {
  AnalysisResult,
  Joint,
  JointId,
  Member,
  SupportReactions,
  Truss,
} from './types'
import { jointById } from './geometry'

type Unknown =
  | { kind: 'member'; memberId: string }
  | { kind: 'rx'; jointId: JointId }
  | { kind: 'ry'; jointId: JointId }

function gaussianSolve(A: number[][], b: number[]): { ok: true; x: number[] } | { ok: false; reason: string } {
  const n = A.length
  if (n === 0) return { ok: false, reason: 'Empty system' }
  const m = A[0]!.length
  if (b.length !== n) return { ok: false, reason: 'Dimension mismatch' }
  if (m !== n) return { ok: false, reason: 'System must be square (determinate)' }

  // Augment
  const M = A.map((row, i) => [...row, b[i]!])

  for (let col = 0; col < n; col++) {
    // Pivot
    let pivot = col
    let best = Math.abs(M[col]![col]!)
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r]![col]!)
      if (v > best) {
        best = v
        pivot = r
      }
    }
    if (best < 1e-10) return { ok: false, reason: 'Singular system (unstable geometry?)' }
    if (pivot !== col) {
      const tmp = M[col]!
      M[col] = M[pivot]!
      M[pivot] = tmp
    }

    // Eliminate
    const diag = M[col]![col]!
    for (let c = col; c <= n; c++) M[col]![c] = M[col]![c]! / diag
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r]![col]!
      if (Math.abs(f) < 1e-12) continue
      for (let c = col; c <= n; c++) {
        M[r]![c] = M[r]![c]! - f * M[col]![c]!
      }
    }
  }

  const x = new Array(n).fill(0).map((_, i) => M[i]![n]!)
  return { ok: true, x }
}

function buildUnknowns(truss: Truss): { unknowns: Unknown[]; ok: true } | { ok: false; reason: string } {
  const pinned = truss.joints.filter((j) => j.support === 'pinned')
  const rollerY = truss.joints.filter((j) => j.support === 'roller' || j.support === 'roller-up')
  const rollerX = truss.joints.filter((j) => j.support === 'roller-x' || j.support === 'roller-left')
  if (pinned.length !== 1 || rollerY.length + rollerX.length !== 1) {
    return { ok: false, reason: 'Need exactly 1 pinned + 1 roller support.' }
  }

  const unknowns: Unknown[] = []
  for (const mem of truss.members) unknowns.push({ kind: 'member', memberId: mem.id })
  unknowns.push({ kind: 'rx', jointId: pinned[0]!.id })
  unknowns.push({ kind: 'ry', jointId: pinned[0]!.id })
  if (rollerY.length === 1) {
    unknowns.push({ kind: 'ry', jointId: rollerY[0]!.id })
  } else {
    unknowns.push({ kind: 'rx', jointId: rollerX[0]!.id })
  }

  return { ok: true, unknowns }
}

function unitDir(from: Joint, to: Joint): { ux: number; uy: number; len: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return { ux: 0, uy: 0, len: 0 }
  return { ux: dx / len, uy: dy / len, len }
}

export function analyzeTruss(truss: Truss): AnalysisResult {
  const n = truss.joints.length
  const m = truss.members.length
  if (n < 2) return { ok: false, reason: 'Add joints and members.' }
  if (m !== 2 * n - 3) return { ok: false, reason: 'Not determinate (m must equal 2n−3).' }

  const unkRes = buildUnknowns(truss)
  if (!unkRes.ok) return { ok: false, reason: unkRes.reason }
  const unknowns = unkRes.unknowns

  const eqCount = 2 * n
  if (unknowns.length !== eqCount) {
    return { ok: false, reason: `Unknowns (${unknowns.length}) != equations (${eqCount}).` }
  }

  // Build A x = b using joint equilibrium.
  const A: number[][] = new Array(eqCount).fill(0).map(() => new Array(eqCount).fill(0))
  const b: number[] = new Array(eqCount).fill(0)

  const jointIndex = new Map<JointId, number>()
  truss.joints.forEach((j, i) => jointIndex.set(j.id, i))

  const memberById = new Map<string, Member>()
  truss.members.forEach((mem) => memberById.set(mem.id, mem))

  const incidentMembers = new Map<JointId, Member[]>()
  for (const j of truss.joints) incidentMembers.set(j.id, [])
  for (const mem of truss.members) {
    incidentMembers.get(mem.a)!.push(mem)
    incidentMembers.get(mem.b)!.push(mem)
  }

  const unknownIndex = (u: Unknown) =>
    unknowns.findIndex((x) => x.kind === u.kind && ('memberId' in x ? x.memberId === (u as any).memberId : x.jointId === (u as any).jointId))

  for (const j of truss.joints) {
    const i = jointIndex.get(j.id)!
    const rowFx = 2 * i
    const rowFy = 2 * i + 1

    // External load: positive downward, so Fy equilibrium uses -load as RHS.
    b[rowFx] = 0
    b[rowFy] = j.loadYkN

    // Member contributions
    for (const mem of incidentMembers.get(j.id) || []) {
      const otherId = mem.a === j.id ? mem.b : mem.a
      const other = jointById(truss, otherId)
      if (!other) continue
      const { ux, uy } = unitDir(j, other)
      const col = unknownIndex({ kind: 'member', memberId: mem.id })
      if (col < 0) continue
      A[rowFx]![col] += ux
      A[rowFy]![col] += uy
    }

    // Support reactions
    if (j.support === 'pinned') {
      const colRx = unknownIndex({ kind: 'rx', jointId: j.id })
      const colRy = unknownIndex({ kind: 'ry', jointId: j.id })
      if (colRx >= 0) A[rowFx]![colRx] += 1
      if (colRy >= 0) A[rowFy]![colRy] += 1
    } else if (j.support === 'roller' || j.support === 'roller-up') {
      const colRy = unknownIndex({ kind: 'ry', jointId: j.id })
      if (colRy >= 0) A[rowFy]![colRy] += 1
    } else if (j.support === 'roller-x' || j.support === 'roller-left') {
      const colRx = unknownIndex({ kind: 'rx', jointId: j.id })
      if (colRx >= 0) A[rowFx]![colRx] += 1
    }
  }

  const sol = gaussianSolve(A, b)
  if (!sol.ok) return { ok: false, reason: sol.reason }

  const memberForces = unknowns
    .map((u, idx) => (u.kind === 'member' ? { memberId: u.memberId, forcekN: sol.x[idx]! } : null))
    .filter(Boolean) as { memberId: string; forcekN: number }[]

  const reactions: SupportReactions = {}
  for (let idx = 0; idx < unknowns.length; idx++) {
    const u = unknowns[idx]!
    const val = sol.x[idx]!
    if (u.kind === 'rx') {
      reactions[u.jointId] = { ...(reactions[u.jointId] || {}), rxkN: val }
    } else if (u.kind === 'ry') {
      reactions[u.jointId] = { ...(reactions[u.jointId] || {}), rykN: val }
    }
  }

  return { ok: true, memberForces, reactions }
}

