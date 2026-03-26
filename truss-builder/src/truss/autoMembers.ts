import type { Joint, Member, Truss } from './types'
import { dist, segmentsIntersect } from './geometry'

type Candidate = {
  a: string
  b: string
  len: number
}

function key(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`
}

function uuid(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function crossesExisting(
  jointsById: Map<string, Joint>,
  a: string,
  b: string,
  existing: { a: string; b: string }[],
): boolean {
  const ja = jointsById.get(a)
  const jb = jointsById.get(b)
  if (!ja || !jb) return true

  for (const e of existing) {
    // shared endpoint is fine
    if (e.a === a || e.a === b || e.b === a || e.b === b) continue
    const j1 = jointsById.get(e.a)
    const j2 = jointsById.get(e.b)
    if (!j1 || !j2) continue
    if (segmentsIntersect(ja, jb, j1, j2)) return true
  }
  return false
}

function buildCandidates(truss: Truss): Candidate[] {
  const out: Candidate[] = []
  for (let i = 0; i < truss.joints.length; i++) {
    for (let k = i + 1; k < truss.joints.length; k++) {
      const a = truss.joints[i]!
      const b = truss.joints[k]!
      const len = dist(a, b)
      if (len <= 3.0000001 && len > 1e-6) out.push({ a: a.id, b: b.id, len })
    }
  }
  out.sort((p, q) => p.len - q.len)
  return out
}

// Heuristic auto-member generator:
// - keep existing members
// - add shortest non-crossing edges (≤3m)
// - ensure connectivity (spanning tree first)
// - then add edges until m = 2n - 3 (if possible)
export function autoAddMembers(truss: Truss): { truss: Truss; message: string } {
  const n = truss.joints.length
  const targetM = 2 * n - 3
  if (n < 2) return { truss, message: 'Add at least 2 joints.' }
  if (targetM < 1) return { truss, message: 'Not enough joints for members.' }

  const jointsById = new Map(truss.joints.map((j) => [j.id, j]))
  const existingPairs = new Set(truss.members.map((m) => key(m.a, m.b)))
  const members: Member[] = [...truss.members]

  const candidates = buildCandidates(truss).filter((c) => !existingPairs.has(key(c.a, c.b)))

  // Union-Find for connectivity
  const parent = new Map<string, string>()
  for (const j of truss.joints) parent.set(j.id, j.id)
  const find = (x: string): string => {
    const p = parent.get(x)!
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  // Seed UF with existing members
  for (const m of members) union(m.a, m.b)

  const edgeListForCross = members.map((m) => ({ a: m.a, b: m.b }))

  let added = 0

  // 1) Ensure connected: add edges that connect different components.
  for (const c of candidates) {
    if (members.length >= targetM) break
    if (find(c.a) === find(c.b)) continue
    if (crossesExisting(jointsById, c.a, c.b, edgeListForCross)) continue
    const id = uuid('m')
    members.push({ id, a: c.a, b: c.b, multiplier: 1 })
    edgeListForCross.push({ a: c.a, b: c.b })
    existingPairs.add(key(c.a, c.b))
    union(c.a, c.b)
    added++
  }

  // 2) Add edges until determinacy target
  for (const c of candidates) {
    if (members.length >= targetM) break
    if (existingPairs.has(key(c.a, c.b))) continue
    if (crossesExisting(jointsById, c.a, c.b, edgeListForCross)) continue
    const id = uuid('m')
    members.push({ id, a: c.a, b: c.b, multiplier: 1 })
    edgeListForCross.push({ a: c.a, b: c.b })
    existingPairs.add(key(c.a, c.b))
    added++
  }

  const msg =
    members.length === targetM
      ? `Added ${added} member(s). Reached m = 2n−3.`
      : `Added ${added} member(s). Could not reach m = 2n−3 with ≤3m non-crossing members.`

  return { truss: { ...truss, members }, message: msg }
}

