/**
 * LaTeX report generation and PDF export for the Truss Builder.
 *
 * Compilation strategy:
 *   1. Generate the full .tex source (with TikZ visualisation – no image file needed).
 *   2. POST to the YtoTech public LaTeX API (free, CORS-enabled).
 *   3. If that fails for any reason, download the raw .tex file instead and
 *      show the user a message explaining how to compile it on Overleaf.
 */

import type { AnalysisResult, CostRates, Truss } from './types'
import type { CostBreakdown } from './cost'
import type { ConstraintSummary } from './constraints'
import type { PrecisionLevel } from './precision'
import { memberLengthM } from './geometry'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Escape the handful of LaTeX special characters that can appear in user data. */
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, (c) => `\\${c}`)
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
}

function fmt(n: number, dec: number): string {
  return n.toFixed(dec)
}

function money(n: number): string {
  return `\\$${n.toFixed(2)}`
}

function passFailCell(ok: boolean): string {
  return ok
    ? '\\cellcolor{green!15}\\textbf{\\textcolor{green!60!black}{PASS}}'
    : '\\cellcolor{red!15}\\textbf{\\textcolor{red!70!black}{FAIL}}'
}

// ─── TikZ truss visualisation ─────────────────────────────────────────────────

function buildTikzPicture(truss: Truss, analysis: AnalysisResult): string {
  if (truss.joints.length === 0) return '\\textit{(No joints to display.)}'

  const jointMap = new Map(truss.joints.map((j) => [j.id, j]))

  // Bounding box
  const xs = truss.joints.map((j) => j.x)
  const ys = truss.joints.map((j) => j.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xRange = Math.max(xMax - xMin, 0.5)
  const yRange = Math.max(yMax - yMin, 0.5)

  // Scale so the widest dimension fits within 13 cm
  const maxDim = 13
  const scale = maxDim / Math.max(xRange, yRange)

  // World → TikZ (cm). Y is flipped so upward = positive on page.
  const tx = (x: number) => ((x - xMin) * scale).toFixed(3)
  const ty = (y: number) => ((yMax - y) * scale).toFixed(3)

  const forceMap = new Map<string, number>()
  if (analysis.ok) {
    for (const f of analysis.memberForces) forceMap.set(f.memberId, f.forcekN)
  }

  const lines: string[] = []
  lines.push('\\begin{tikzpicture}[line cap=round,line join=round]')

  // ── Members ──────────────────────────────────────────────────────────────
  for (const mem of truss.members) {
    const a = jointMap.get(mem.a)
    const b = jointMap.get(mem.b)
    if (!a || !b) continue
    const f = forceMap.get(mem.id)
    let color = 'black'
    if (f !== undefined) {
      color = Math.abs(f) > 12 ? 'red' : f >= 0 ? 'blue!80!black' : 'green!60!black'
    }
    const lw = mem.multiplier >= 2 ? 'very thick' : 'thick'
    lines.push(
      `  \\draw[${color},${lw}] (${tx(a.x)},${ty(a.y)}) -- (${tx(b.x)},${ty(b.y)});`
    )
  }

  // ── Load arrows (downward in world = downward on page) ────────────────────
  for (const j of truss.joints) {
    if (j.loadYkN === 0) continue
    const ax = parseFloat(tx(j.x))
    const ay = parseFloat(ty(j.y))
    const arrowLen = Math.min(scale * 0.6, 1.2)
    const startY = (ay - arrowLen).toFixed(3)
    lines.push(
      `  \\draw[-{Stealth[length=5pt]},red,very thick] (${ax},${startY}) -- (${ax},${ay.toFixed(3)});`
    )
    lines.push(
      `  \\node[red,left,font=\\scriptsize] at (${ax},${((ay + parseFloat(startY)) / 2).toFixed(3)}) {${fmt(j.loadYkN, 2)} kN};`
    )
  }

  // ── Joints ────────────────────────────────────────────────────────────────
  for (const j of truss.joints) {
    const cx = tx(j.x)
    const cy = ty(j.y)
    const stroke = j.support === 'pinned' ? 'violet' : j.support === 'roller' ? 'cyan!70!black' : 'black'
    lines.push(`  \\filldraw[fill=white,draw=${stroke},thick] (${cx},${cy}) circle (0.12cm);`)

    // Support symbol
    if (j.support === 'pinned' || j.support === 'roller') {
      const x = parseFloat(cx)
      const y = parseFloat(cy)
      const s = 0.22
      const col = j.support === 'pinned' ? 'violet' : 'cyan!70!black'
      lines.push(
        `  \\draw[${col},thick] (${x},${y}) -- (${(x - s).toFixed(3)},${(y - s * 1.6).toFixed(3)}) -- (${(x + s).toFixed(3)},${(y - s * 1.6).toFixed(3)}) -- cycle;`
      )
      lines.push(
        `  \\draw[${col},thick] (${(x - s * 1.3).toFixed(3)},${(y - s * 1.6).toFixed(3)}) -- (${(x + s * 1.3).toFixed(3)},${(y - s * 1.6).toFixed(3)});`
      )
      if (j.support === 'roller') {
        lines.push(
          `  \\draw[${col}] (${x},${(y - s * 1.6 - 0.18).toFixed(3)}) circle (0.09cm);`
        )
      }
    }

    // Label
    lines.push(`  \\node[above right,font=\\small\\bfseries] at (${cx},${cy}) {${esc(j.label)}};`)

    // Coordinate
    lines.push(
      `  \\node[below right,font=\\tiny,gray] at (${cx},${cy}) {(${fmt(j.x, 2)},\\,${fmt(j.y, 2)})};`
    )
  }

  // ── Member force labels ───────────────────────────────────────────────────
  for (const mem of truss.members) {
    const a = jointMap.get(mem.a)
    const b = jointMap.get(mem.b)
    if (!a || !b) continue
    const f = forceMap.get(mem.id)
    if (f === undefined) continue
    const mx = ((parseFloat(tx(a.x)) + parseFloat(tx(b.x))) / 2).toFixed(3)
    const my = ((parseFloat(ty(a.y)) + parseFloat(ty(b.y))) / 2).toFixed(3)
    const color = Math.abs(f) > 12 ? 'red' : f >= 0 ? 'blue!80!black' : 'green!60!black'
    lines.push(
      `  \\node[${color},font=\\tiny,fill=white,fill opacity=0.7,text opacity=1] at (${mx},${my}) {${fmt(f, 2)} kN};`
    )
  }

  lines.push('\\end{tikzpicture}')
  return lines.join('\n')
}

// ─── per-joint equilibrium equations ─────────────────────────────────────────

function buildEquationsSection(truss: Truss, analysis: AnalysisResult, prec: number): string {
  if (truss.joints.length === 0) return '\\textit{No joints defined.}\n\n'

  const jointMap = new Map(truss.joints.map((j) => [j.id, j]))
  const forceMap = new Map<string, number>()
  if (analysis.ok) {
    for (const f of analysis.memberForces) forceMap.set(f.memberId, f.forcekN)
  }

  // Incident members per joint
  const incident = new Map<string, typeof truss.members>(truss.joints.map((j) => [j.id, []]))
  for (const mem of truss.members) {
    incident.get(mem.a)?.push(mem)
    incident.get(mem.b)?.push(mem)
  }

  const blocks: string[] = []

  for (const joint of truss.joints) {
    const mems = incident.get(joint.id) ?? []
    const fxTerms: string[] = []
    const fyTerms: string[] = []

    for (const mem of mems) {
      const otherId = mem.a === joint.id ? mem.b : mem.a
      const other = jointMap.get(otherId)
      if (!other) continue
      const dx = other.x - joint.x
      const dy = other.y - joint.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-9) continue
      const ux = dx / len
      const uy = dy / len
      // Use the two joint labels to form member name
      const labA = joint.label
      const labB = other.label
      // Sort so the label is consistent regardless of orientation
      const memLabel = [labA, labB].sort().join('')
      const uxStr = fmt(ux, 4)
      const uyStr = fmt(uy, 4)
      fxTerms.push(`(${uxStr})\\,F_{\\text{${esc(memLabel)}}}`)
      fyTerms.push(`(${uyStr})\\,F_{\\text{${esc(memLabel)}}}`)
    }

    if (joint.support === 'pinned') {
      fxTerms.push(`R_{${esc(joint.label)}x}`)
      fyTerms.push(`R_{${esc(joint.label)}y}`)
    } else if (joint.support === 'roller') {
      fyTerms.push(`R_{${esc(joint.label)}y}`)
    }

    const fyRhs = joint.loadYkN !== 0 ? fmt(joint.loadYkN, prec) : '0'

    const fxEq = fxTerms.length > 0 ? fxTerms.join(' + ') : '0'
    const fyEq = fyTerms.length > 0 ? fyTerms.join(' + ') : '0'

    blocks.push(`\\paragraph*{Joint ${esc(joint.label)} \\normalfont\\small$(x = ${fmt(joint.x, prec)}\\,\\text{m},\\; y = ${fmt(joint.y, prec)}\\,\\text{m})$}`)
    blocks.push('\\begin{align}')
    blocks.push(`  \\textstyle\\sum F_x = 0: &\\quad ${fxEq} = 0 \\\\`)
    blocks.push(`  \\textstyle\\sum F_y = 0: &\\quad ${fyEq} = ${fyRhs}`)
    blocks.push('\\end{align}')

    if (analysis.ok) {
      // Solved values for members at this joint
      const solvedLines: string[] = []
      for (const mem of mems) {
        const f = forceMap.get(mem.id)
        if (f === undefined) continue
        const otherId = mem.a === joint.id ? mem.b : mem.a
        const other = jointMap.get(otherId)
        if (!other) continue
        const labA = joint.label
        const labB = other.label
        const memLabel = [labA, labB].sort().join('')
        const typeStr = f >= 0 ? 'Tension' : 'Compression'
        const color = Math.abs(f) > 12 ? 'red' : f >= 0 ? 'blue!80!black' : 'green!60!black'
        solvedLines.push(
          `$F_{\\text{${esc(memLabel)}}} = {\\color{${color}}${fmt(f, prec)}\\,\\text{kN}}$ (${typeStr})`
        )
      }
      if (joint.support !== 'none') {
        const rx = analysis.reactions[joint.id]?.rxkN
        const ry = analysis.reactions[joint.id]?.rykN
        if (rx !== undefined) solvedLines.push(`$R_{${esc(joint.label)}x} = ${fmt(rx, prec)}\\,\\text{kN}$`)
        if (ry !== undefined) solvedLines.push(`$R_{${esc(joint.label)}y} = ${fmt(ry, prec)}\\,\\text{kN}$`)
      }
      if (solvedLines.length > 0) {
        blocks.push('\\textbf{Solved:} ' + solvedLines.join(',\\quad ') + '\n')
      }
    }

    blocks.push('')
  }

  return blocks.join('\n')
}

// ─── full LaTeX document ──────────────────────────────────────────────────────

export interface LatexParams {
  truss: Truss
  analysis: AnalysisResult
  constraints: ConstraintSummary
  cost: CostBreakdown
  costRates: CostRates
  precision: PrecisionLevel
  authorName?: string
}

export function generateLatex(p: LatexParams): string {
  const { truss, analysis, constraints, cost, costRates, precision, authorName = '' } = p
  const n = truss.joints.length
  const m = truss.members.length
  const det2n3 = 2 * n - 3
  const prec = precision as number

  const jointMap = new Map(truss.joints.map((j) => [j.id, j]))
  const memberMap = new Map(truss.members.map((mm) => [mm.id, mm]))

  // ── preamble ──────────────────────────────────────────────────────────────
  const preamble = `\\documentclass[12pt,a4paper]{article}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{colortbl}
\\usepackage{tikz}
\\usetikzlibrary{arrows.meta}
\\usepackage{xcolor}
\\usepackage{float}
\\usepackage{parskip}
\\usepackage{microtype}
\\usepackage{hyperref}
\\usepackage{fancyhdr}

\\hypersetup{colorlinks=true,linkcolor=blue!70!black,urlcolor=blue!70!black}

\\pagestyle{fancy}
\\fancyhf{}
\\lhead{\\textsc{Truss Design Report}}
\\rhead{\\today}
\\cfoot{\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}

\\definecolor{tenscol}{RGB}{37,99,235}
\\definecolor{compcol}{RGB}{22,163,74}
\\definecolor{overcol}{RGB}{220,38,38}
`

  // ── title page ────────────────────────────────────────────────────────────
  const authorLine = authorName.trim() ? `\\author{${esc(authorName.trim())}}` : '\\author{}'
  const titlePage = `\\title{\\textbf{Truss Design Report}\\\\[0.6em]\\large MTE119 Engineering Design}
${authorLine}
\\date{\\today}

\\begin{document}
\\maketitle
\\thispagestyle{empty}

\\vspace{1.5cm}
\\begin{center}
  \\renewcommand{\\arraystretch}{1.5}
  \\begin{tabular}{lr}
    \\toprule
    \\textbf{Joints} ($n$) & ${n} \\\\
    \\textbf{Members} ($m$) & ${m} \\\\
    \\textbf{Determinacy} ($2n-3$) & ${det2n3} \\\\
    \\midrule
    \\textbf{Total Cost} & \\large\\bfseries${money(cost.totalCost)} \\\\
    \\bottomrule
  \\end{tabular}
\\end{center}

\\vspace{2cm}
\\tableofcontents
\\newpage
`

  // ── §1 Overview ───────────────────────────────────────────────────────────
  const detOk = m === det2n3
  const sec1 = `\\section{Overview}

This report presents the structural analysis of a planar pin-jointed truss designed using the Truss Builder tool.

\\begin{description}
  \\item[Number of joints] $n = ${n}$
  \\item[Number of members] $m = ${m}$
  \\item[Determinacy check] $m = ${m}$, $2n - 3 = ${det2n3}$ \\quad ${detOk ? '\\textcolor{green!60!black}{\\bfseries Statically determinate}' : '\\textcolor{red}{\\bfseries Not statically determinate}'}
  \\item[Total member length] ${fmt(cost.totalMemberLengthM, prec)}\\,m
  \\item[Pylon height] ${fmt(truss.pylonHeightM, prec)}\\,m
\\end{description}
`

  // ── §2 Joint coordinates ──────────────────────────────────────────────────
  const jointRows = truss.joints
    .map((j) => {
      const supStr = j.support === 'none' ? '---' : j.support.charAt(0).toUpperCase() + j.support.slice(1)
      const loadStr = j.loadYkN !== 0 ? `${fmt(j.loadYkN, prec)}\\,kN` : '---'
      return `    ${esc(j.label)} & ${fmt(j.x, prec)} & ${fmt(j.y, prec)} & ${supStr} & ${loadStr} \\\\`
    })
    .join('\n')

  const sec2 = `\\section{Joint Coordinates}

\\begin{table}[H]
  \\centering
  \\caption{Joint coordinates and boundary conditions}
  \\begin{tabularx}{\\textwidth}{@{}lrrllX@{}}
    \\toprule
    \\textbf{Joint} & \\textbf{$x$ (m)} & \\textbf{$y$ (m)} & \\textbf{Support} & \\textbf{Load} & \\\\
    \\midrule
${jointRows || '    \\multicolumn{5}{c}{\\textit{No joints defined.}} \\\\'}
    \\bottomrule
  \\end{tabularx}
\\end{table}
`

  // ── §3 Member list ────────────────────────────────────────────────────────
  const memberRows = truss.members
    .map((mem) => {
      const a = jointMap.get(mem.a)
      const b = jointMap.get(mem.b)
      if (!a || !b) return null
      const len = memberLengthM(truss, mem)
      const lenStr = Number.isFinite(len) ? `${fmt(len, prec)}\\,m` : '---'
      const multStr = mem.multiplier > 1 ? `$\\times${mem.multiplier}$` : '1'
      const effLen = Number.isFinite(len) ? `${fmt(len * mem.multiplier, prec)}\\,m` : '---'
      return `    ${esc(a.label)}--${esc(b.label)} & ${lenStr} & ${multStr} & ${effLen} \\\\`
    })
    .filter(Boolean)
    .join('\n')

  const sec3 = `\\section{Member List}

\\begin{table}[H]
  \\centering
  \\caption{Members, lengths, and multipliers}
  \\begin{tabular}{@{}lrrr@{}}
    \\toprule
    \\textbf{Member} & \\textbf{Length} & \\textbf{Multiplier} & \\textbf{Effective length} \\\\
    \\midrule
${memberRows || '    \\multicolumn{4}{c}{\\textit{No members defined.}} \\\\'}
    \\bottomrule
  \\end{tabular}
\\end{table}
`

  // ── §4 Structural analysis ─────────────────────────────────────────────────
  const forceRows = analysis.ok
    ? analysis.memberForces
        .map((f) => {
          const mem = memberMap.get(f.memberId)
          if (!mem) return null
          const a = jointMap.get(mem.a)
          const b = jointMap.get(mem.b)
          if (!a || !b) return null
          const isTension = f.forcekN >= 0
          const over = Math.abs(f.forcekN) > 12
          const color = over ? 'overcol' : isTension ? 'tenscol' : 'compcol'
          const typeStr = isTension ? 'Tension' : 'Compression'
          return `    ${esc(a.label)}--${esc(b.label)} & {\\color{${color}}${fmt(f.forcekN, prec)}} & {\\color{${color}}${typeStr}} \\\\`
        })
        .filter(Boolean)
        .join('\n')
    : null

  const reactionsLatex = analysis.ok
    ? Object.entries(analysis.reactions)
        .map(([jid, r]) => {
          const j = jointMap.get(jid)
          if (!j || j.support === 'none') return null
          const parts: string[] = []
          if (r.rxkN !== undefined) parts.push(`$R_{${esc(j.label)}x} = ${fmt(r.rxkN, prec)}\\,\\text{kN}$`)
          if (r.rykN !== undefined) parts.push(`$R_{${esc(j.label)}y} = ${fmt(r.rykN, prec)}\\,\\text{kN}$`)
          return parts.join(', ')
        })
        .filter(Boolean)
        .join('\\quad ')
    : null

  const sec4 = `\\section{Structural Analysis}

${
  !analysis.ok
    ? `\\textit{Analysis unavailable: ${esc(analysis.reason)}}`
    : `\\subsection{Support Reactions}

${reactionsLatex ?? '---'}

\\subsection{Member Forces}

\\begin{table}[H]
  \\centering
  \\caption{Member forces (\\textcolor{tenscol}{blue = tension}, \\textcolor{compcol}{green = compression}, \\textcolor{overcol}{red = exceeds limit})}
  \\begin{tabular}{@{}lrr@{}}
    \\toprule
    \\textbf{Member} & \\textbf{Force (kN)} & \\textbf{Type} \\\\
    \\midrule
${forceRows || '    \\multicolumn{3}{c}{\\textit{No results.}} \\\\'}
    \\bottomrule
  \\end{tabular}
\\end{table}

\\subsection{Method of Joints --- Equilibrium Equations}

${buildEquationsSection(truss, analysis, prec)}`
}
`

  // ── §5 Constraints ────────────────────────────────────────────────────────
  const constraintRows = constraints.results
    .map((r) => {
      const detailsStr = r.details ? `\\newline\\footnotesize\\textit{${esc(r.details)}}` : ''
      return `    ${esc(r.label)}${detailsStr} & ${passFailCell(r.ok)} \\\\`
    })
    .join('\n')

  const allOk = constraints.results.every((r) => r.ok)
  const sec5 = `\\section{Constraints Check}

\\begin{table}[H]
  \\centering
  \\caption{Design constraint evaluation}
  \\begin{tabular}{@{}p{10cm}c@{}}
    \\toprule
    \\textbf{Constraint} & \\textbf{Status} \\\\
    \\midrule
${constraintRows || '    \\multicolumn{2}{c}{\\textit{No constraints evaluated.}} \\\\'}
    \\midrule
    \\textbf{Overall} & ${passFailCell(allOk)} \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}
`

  // ── §6 Cost breakdown ─────────────────────────────────────────────────────
  const sec6 = `\\section{Cost Breakdown}

\\subsection*{Cost Parameters}

\\begin{tabular}{@{}lr@{}}
  \\toprule
  \\textbf{Item} & \\textbf{Rate} \\\\
  \\midrule
  Member material & ${money(costRates.memberPerM)}/m \\\\
  Joint & ${money(costRates.perJoint)} each \\\\
  Pylon & ${money(costRates.pylonPerM)}/m \\\\
  Rope (per loaded joint) & ${money(costRates.perRope)} each \\\\
  \\bottomrule
\\end{tabular}

\\subsection*{Calculation}

\\begin{align*}
  C_{\\text{members}} &= ${money(costRates.memberPerM)}/\\text{m} \\times ${fmt(cost.totalMemberLengthM, prec)}\\,\\text{m} = ${money(cost.memberCost)} \\\\
  C_{\\text{joints}}  &= ${money(costRates.perJoint)} \\times ${n}\\,\\text{joints} = ${money(cost.jointCost)} \\\\
  C_{\\text{pylons}}  &= ${money(costRates.pylonPerM)}/\\text{m} \\times ${fmt(truss.pylonHeightM, prec)}\\,\\text{m} = ${money(cost.pylonCost)} \\\\
  C_{\\text{ropes}}   &= ${money(costRates.perRope)} \\times ${cost.ropeCount}\\,\\text{ropes} = ${money(cost.ropeCost)} \\\\[0.5em]
  \\hline\\\\[-0.8em]
  C_{\\text{total}}   &= ${money(cost.memberCost)} + ${money(cost.jointCost)} + ${money(cost.pylonCost)} + ${money(cost.ropeCost)} = \\boxed{${money(cost.totalCost)}}
\\end{align*}
`

  // ── §7 Visualisation ──────────────────────────────────────────────────────
  const tikz = buildTikzPicture(truss, analysis)
  const sec7 = `\\section{Truss Visualisation}

\\begin{figure}[H]
  \\centering
${tikz}
  \\caption{Truss diagram.
    \\textcolor{blue!80!black}{Blue} = tension,
    \\textcolor{green!60!black}{green} = compression,
    \\textcolor{red}{red} = over limit / no analysis.
    \\textcolor{violet}{Violet triangle} = pinned support,
    \\textcolor{cyan!70!black}{cyan triangle} = roller support.}
\\end{figure}
`

  return [
    preamble,
    titlePage,
    sec1,
    sec2,
    sec3,
    sec4,
    sec5,
    sec6,
    sec7,
    '\\end{document}\n',
  ].join('\n')
}

// ─── export helpers ───────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTexSource(source: string, filename = 'truss-report.tex') {
  downloadBlob(new Blob([source], { type: 'text/plain' }), filename)
}

/** Downloads the raw .tex source without attempting PDF compilation. */
export function exportLatexSource(params: LatexParams) {
  downloadTexSource(generateLatex(params))
}

/**
 * Attempts to compile via the YtoTech public LaTeX API.
 * Returns true and triggers a PDF download if successful; returns false otherwise.
 */
async function tryCompileViaPdfLatex(source: string): Promise<boolean> {
  try {
    const resp = await fetch('https://latex.ytotech.com/builds/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: 'pdflatex',
        resources: [{ main: true, content: source }],
      }),
    })

    if (!resp.ok) return false

    const ct = resp.headers.get('content-type') ?? ''
    if (ct.includes('application/pdf')) {
      downloadBlob(await resp.blob(), 'truss-report.pdf')
      return true
    }

    // Some API versions return JSON with a download URL
    const json = await resp.json().catch(() => null)
    if (json?.download) {
      const pdfResp = await fetch(json.download)
      if (pdfResp.ok) {
        downloadBlob(await pdfResp.blob(), 'truss-report.pdf')
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Main export entry point.
 * 1. Tries to compile the .tex source to a PDF via a public API.
 * 2. Falls back to downloading the raw .tex file with a message.
 *
 * Returns a status string suitable for showing in the UI.
 */
export async function exportLatexReport(
  params: LatexParams
): Promise<{ ok: boolean; message: string }> {
  const source = generateLatex(params)

  const compiled = await tryCompileViaPdfLatex(source)
  if (compiled) {
    return { ok: true, message: 'PDF downloaded successfully.' }
  }

  // Fallback: download the .tex file
  downloadTexSource(source)
  return {
    ok: false,
    message:
      'PDF compilation service unreachable. Downloaded truss-report.tex instead.\n' +
      'To convert to PDF:\n' +
      '  • Upload to https://www.overleaf.com (free online compiler), or\n' +
      '  • Run: pdflatex truss-report.tex  (requires a local LaTeX installation)',
  }
}
