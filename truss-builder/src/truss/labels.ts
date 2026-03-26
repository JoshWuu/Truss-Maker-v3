export function indexToLabel(idx0: number): string {
  if (!Number.isFinite(idx0) || idx0 < 0) return '?'
  let n = Math.floor(idx0)
  let label = ''
  while (true) {
    const r = n % 26
    label = String.fromCharCode(65 + r) + label
    n = Math.floor(n / 26) - 1
    if (n < 0) break
  }
  return label
}

