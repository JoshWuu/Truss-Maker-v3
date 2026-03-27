import type { CostRates, Truss } from './types'
import { DEFAULT_COST_RATES } from './types'
import { memberLengthM } from './geometry'

export type CostBreakdown = {
  totalMemberLengthM: number
  memberCost: number
  jointCost: number
  pylonCost: number
  ropeCost: number
  ropeCount: number
  totalCost: number
}

export function computeCost(truss: Truss, rates: CostRates = DEFAULT_COST_RATES): CostBreakdown {
  const totalMemberLengthM = truss.members.reduce((sum, m) => {
    const len = memberLengthM(truss, m)
    if (!Number.isFinite(len)) return sum
    return sum + len * m.multiplier
  }, 0)

  const memberCost = rates.memberPerM * totalMemberLengthM
  const jointCost = rates.perJoint * truss.joints.length
  const pylonCost = rates.pylonPerM * Math.max(0, truss.pylonHeightM || 0)
  const ropeCount = truss.joints.filter((j) => j.loadYkN !== 0).length
  const ropeCost = rates.perRope * ropeCount
  const totalCost = memberCost + jointCost + pylonCost + ropeCost

  return {
    totalMemberLengthM,
    memberCost,
    jointCost,
    pylonCost,
    ropeCost,
    ropeCount,
    totalCost,
  }
}
