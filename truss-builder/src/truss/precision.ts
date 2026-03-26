/**
 * Precision utilities for handling coordinate and calculation display.
 * Maintains internal accuracy while providing clean display formatting.
 */

export type PrecisionLevel = 1 | 2 | 3 | 4

export type StepSize = 0.01 | 0.05 | 0.1 | 0.5 | 1

/**
 * Formats a number to a specified number of decimal places.
 * Does not truncate internally; only affects display.
 */
export function formatCoordinate(value: number, decimalPlaces: PrecisionLevel = 3): string {
  return value.toFixed(decimalPlaces)
}

/**
 * Formats a number for display in engineering contexts.
 * Uses fixed decimal places for consistency.
 */
export function formatEngineering(value: number, decimalPlaces: PrecisionLevel = 3): string {
  return value.toFixed(decimalPlaces)
}

/**
 * Rounds a number to a specific step size (for arrow key movement).
 * Prevents floating point drift.
 */
export function roundToStep(value: number, step: StepSize): number {
  // Use a large multiplier to work with integers and avoid floating point errors
  const multiplier = 100000
  const scaled = Math.round((value / step) * multiplier) / multiplier
  return scaled * step
}

/**
 * Clamps a number to a reasonable precision range to avoid floating point errors.
 * Internally, keep full precision. This is mainly for rounding display values.
 */
export function cleanValue(value: number, tolerance: number = 1e-10): number {
  // If very close to an integer or simple fraction, snap to it
  const rounded = Math.round(value * 1e6) / 1e6
  return Math.abs(value - rounded) < tolerance ? rounded : value
}

/**
 * Validates and parses a coordinate input string.
 * Returns null if invalid.
 */
export function parseCoordinate(input: string): number | null {
  const num = parseFloat(input)
  return Number.isFinite(num) ? num : null
}

/**
 * Formats a distance/length for display.
 */
export function formatDistance(value: number, decimalPlaces: PrecisionLevel = 3): string {
  return value.toFixed(decimalPlaces)
}

/**
 * Formats a force value for display.
 */
export function formatForce(value: number, decimalPlaces: PrecisionLevel = 2): string {
  return value.toFixed(decimalPlaces)
}

/**
 * Gets all available precision levels.
 */
export const PRECISION_LEVELS: PrecisionLevel[] = [1, 2, 3, 4]

/**
 * Gets all available step sizes for movement.
 */
export const STEP_SIZES: StepSize[] = [0.01, 0.05, 0.1, 0.5, 1]
