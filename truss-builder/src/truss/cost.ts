import type { Truss } from './types'
import { memberLengthM } from './geometry'

export type CostBreakdown = {
  totalMemberLengthM: number
  memberCost: number
  jointCost: number
  pylonCost: number
  ropeCost: number
  totalCost: number
}

export function computeCost(truss: Truss): CostBreakdown {
  const totalMemberLengthM = truss.members.reduce((sum, m) => {
    const len = memberLengthM(truss, m)
    if (!Number.isFinite(len)) return sum
    return sum + len * m.multiplier
  }, 0)

  const memberCost = 12 * totalMemberLengthM
  const jointCost = 3 * truss.joints.length
  const pylonCost = 6 * Math.max(0, truss.pylonHeightM || 0)
  const ropeCount = truss.joints.filter((j) => j.loadYkN !== 0).length
  const ropeCost = 4 * ropeCount
  const totalCost = memberCost + jointCost + pylonCost + ropeCost

  return {
    totalMemberLengthM,
    memberCost,
    jointCost,
    pylonCost,
    ropeCost,
    totalCost,
  }
}

