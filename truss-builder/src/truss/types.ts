export type JointId = string
export type MemberId = string

export type Vec2 = { x: number; y: number }

export type SupportType = 'none' | 'pinned' | 'roller'

export type Joint = {
  id: JointId
  label: string
  x: number
  y: number
  support: SupportType
  loadYkN: number // vertical load only; positive = downward (kN)
}

export type Member = {
  id: MemberId
  a: JointId
  b: JointId
  multiplier: 1 | 2 | 3
}

export type Truss = {
  joints: Joint[]
  members: Member[]
  pylonHeightM: number
}

export type ToolMode = 'joint' | 'member' | 'support' | 'load' | 'select'

export type MemberForce = {
  memberId: MemberId
  forcekN: number // +tension, -compression
}

export type SupportReactions = Record<
  JointId,
  {
    rxkN?: number
    rykN?: number
  }
>

export type AnalysisResult =
  | {
      ok: true
      memberForces: MemberForce[]
      reactions: SupportReactions
    }
  | {
      ok: false
      reason: string
    }

