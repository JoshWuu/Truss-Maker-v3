import type { Joint, JointId, Member, Truss, Vec2 } from './types'

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function memberLengthM(truss: Truss, member: Member): number {
  const ja = truss.joints.find((j) => j.id === member.a)
  const jb = truss.joints.find((j) => j.id === member.b)
  if (!ja || !jb) return NaN
  return dist(ja, jb)
}

export function jointById(truss: Truss, id: JointId): Joint | undefined {
  return truss.joints.find((j) => j.id === id)
}

export function snap(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value
  return Math.round(value / step) * step
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  )
}

export function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const o1 = orient(a1, a2, b1)
  const o2 = orient(a1, a2, b2)
  const o3 = orient(b1, b2, a1)
  const o4 = orient(b1, b2, a2)

  if (o1 === 0 && onSegment(a1, a2, b1)) return true
  if (o2 === 0 && onSegment(a1, a2, b2)) return true
  if (o3 === 0 && onSegment(b1, b2, a1)) return true
  if (o4 === 0 && onSegment(b1, b2, a2)) return true

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)
}

export function segmentIntersectsRect(
  a: Vec2,
  b: Vec2,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  // Cohen–Sutherland style clipping test (fast + robust enough for MVP)
  const INSIDE = 0
  const LEFT = 1
  const RIGHT = 2
  const BOTTOM = 4
  const TOP = 8

  const outCode = (p: Vec2) => {
    let code = INSIDE
    if (p.x < rect.minX) code |= LEFT
    else if (p.x > rect.maxX) code |= RIGHT
    if (p.y < rect.minY) code |= BOTTOM
    else if (p.y > rect.maxY) code |= TOP
    return code
  }

  let p0 = { ...a }
  let p1 = { ...b }
  let c0 = outCode(p0)
  let c1 = outCode(p1)

  while (true) {
    if ((c0 | c1) === 0) return true // both inside
    if ((c0 & c1) !== 0) return false // trivially outside

    const cOut = c0 !== 0 ? c0 : c1
    let x = 0
    let y = 0

    if (cOut & TOP) {
      x = p0.x + ((p1.x - p0.x) * (rect.maxY - p0.y)) / (p1.y - p0.y)
      y = rect.maxY
    } else if (cOut & BOTTOM) {
      x = p0.x + ((p1.x - p0.x) * (rect.minY - p0.y)) / (p1.y - p0.y)
      y = rect.minY
    } else if (cOut & RIGHT) {
      y = p0.y + ((p1.y - p0.y) * (rect.maxX - p0.x)) / (p1.x - p0.x)
      x = rect.maxX
    } else if (cOut & LEFT) {
      y = p0.y + ((p1.y - p0.y) * (rect.minX - p0.x)) / (p1.x - p0.x)
      x = rect.minX
    }

    if (cOut === c0) {
      p0 = { x, y }
      c0 = outCode(p0)
    } else {
      p1 = { x, y }
      c1 = outCode(p1)
    }
  }
}

