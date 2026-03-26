import type { AnalysisResult, Truss } from './types'
import { memberLengthM } from './geometry'
import { formatCoordinate, formatDistance, formatForce, type PrecisionLevel } from './precision'

/**
 * Generate a formatted text report of all calculations
 */
export function generateCalculationsReport(
  truss: Truss,
  analysis: AnalysisResult,
  precision: PrecisionLevel = 3
): string {
  const lines: string[] = []

  lines.push('TRUSS ANALYSIS REPORT')
  lines.push('='.repeat(80))
  lines.push('')

  // Summary
  lines.push('SUMMARY')
  lines.push('-'.repeat(80))
  lines.push(`Joints: ${truss.joints.length}`)
  lines.push(`Members: ${truss.members.length}`)
  lines.push(`Pylon Height: ${truss.pylonHeightM.toFixed(1)} m`)
  lines.push('')

  // Joint Coordinates
  lines.push('JOINT COORDINATES')
  lines.push('-'.repeat(80))
  lines.push('Label | X (m) | Y (m) | Support | Load (kN)')
  lines.push('-'.repeat(80))
  truss.joints.forEach((joint) => {
    const x = formatCoordinate(joint.x, precision)
    const y = formatCoordinate(joint.y, precision)
    const support = joint.support === 'none' ? 'None' : joint.support.charAt(0).toUpperCase() + joint.support.slice(1)
    const load = joint.loadYkN === 0 ? '-' : formatForce(joint.loadYkN, 2)
    lines.push(`${joint.label.padEnd(5)} | ${x.padEnd(6)} | ${y.padEnd(6)} | ${support.padEnd(7)} | ${load}`)
  })
  lines.push('')

  // Member Lengths
  lines.push('MEMBER LENGTHS')
  lines.push('-'.repeat(80))
  lines.push('Member | Joint A | Joint B | Distance Formula | Length (m)')
  lines.push('-'.repeat(80))
  
  const memberById = new Map(truss.members.map((m) => [m.id, m]))
  const jointById = new Map(truss.joints.map((j) => [j.id, j]))

  truss.members.forEach((member) => {
    const ja = jointById.get(member.a)
    const jb = jointById.get(member.b)
    if (!ja || !jb) return

    const length = memberLengthM(truss, member)

    const formula = `√((${formatCoordinate(jb.x, 2)}-${formatCoordinate(ja.x, 2)})² + (${formatCoordinate(jb.y, 2)}-${formatCoordinate(ja.y, 2)})²)`
    const memberLabel = `${ja.label}-${jb.label}`
    lines.push(`${memberLabel.padEnd(7)} | ${ja.label.padEnd(7)} | ${jb.label.padEnd(7)} | ${formula.padEnd(17)} | ${formatDistance(length, precision)}`)
  })
  lines.push('')

  // Support Reactions
  if (analysis.ok) {
    lines.push('SUPPORT REACTIONS')
    lines.push('-'.repeat(80))
    lines.push('Joint | Type | Reaction X (kN) | Reaction Y (kN)')
    lines.push('-'.repeat(80))

    Object.entries(analysis.reactions).forEach(([jointId, reaction]) => {
      const joint = jointById.get(jointId)
      if (!joint || joint.support === 'none') return

      const rx = reaction.rxkN !== undefined ? formatForce(reaction.rxkN, precision) : '—'
      const ry = reaction.rykN !== undefined ? formatForce(reaction.rykN, precision) : '—'
      lines.push(`${joint.label.padEnd(5)} | ${joint.support.padEnd(4)} | ${rx.padEnd(15)} | ${ry}`)
    })
    lines.push('')
  }

  // Member Forces (Method of Joints)
  if (analysis.ok) {
    lines.push('MEMBER FORCES (METHOD OF JOINTS)')
    lines.push('-'.repeat(80))
    lines.push('Member | Force (kN) | Type')
    lines.push('-'.repeat(80))

    analysis.memberForces.forEach((force) => {
      const member = memberById.get(force.memberId)
      if (!member) return

      const ja = jointById.get(member.a)
      const jb = jointById.get(member.b)
      if (!ja || !jb) return

      const forceType = force.forcekN >= 0 ? 'Tension' : 'Compression'
      const memberLabel = `${ja.label}-${jb.label}`
      lines.push(`${memberLabel.padEnd(7)} | ${formatForce(force.forcekN, 2).padEnd(10)} | ${forceType}`)
    })
    lines.push('')
  } else {
    lines.push('ANALYSIS ERROR')
    lines.push('-'.repeat(80))
    lines.push(analysis.reason)
    lines.push('')
  }

  lines.push('='.repeat(80))
  lines.push(`Generated: ${new Date().toLocaleString()}`)

  return lines.join('\n')
}

/**
 * Download calculations as a text file
 */
export function downloadCalculations(
  truss: Truss,
  analysis: AnalysisResult,
  precision: PrecisionLevel = 3,
  filename = 'truss-calculations.txt'
): void {
  const text = generateCalculationsReport(truss, analysis, precision)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
