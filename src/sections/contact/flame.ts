/**
 * The lantern flame's timing (design.md §8.7 E1, §15): a slow breath on a 3 to 5 s cycle with a
 * fast, low flicker on top. Brightness never leaves 0.92..1.0 and nothing runs faster than 3 Hz,
 * so it stays well inside the photosensitive limits. Pure, so tests can sweep it.
 */

const TAU = Math.PI * 2

/** Flame brightness and the warm term's strength, 0.92..1.0. */
export const FLAME_RANGE = [0.92, 1] as const

/** Breath, −1..1: two slow sines (3.7 s and 4.9 s) beat into an uneven 3 to 5 s rhythm. */
export function flameBreath(t: number): number {
  return 0.6 * Math.sin((TAU * t) / 3.7) + 0.4 * Math.sin((TAU * t) / 4.9 + 1.1)
}

/** Flicker, −1..1, at about 1.3 and 2.7 Hz. */
export function flameFlicker(t: number): number {
  return 0.55 * Math.sin(TAU * 1.3 * t + 0.4) + 0.45 * Math.sin(TAU * 2.7 * t + 2.2)
}

/** Brightness at time t, in FLAME_RANGE. Steady at the top of the range when motion is off. */
export function flameLevel(t: number, still: boolean): number {
  if (still) return FLAME_RANGE[1] - 0.02
  const v = 0.96 + 0.025 * flameBreath(t) + 0.012 * flameFlicker(t)
  return Math.min(FLAME_RANGE[1], Math.max(FLAME_RANGE[0], v))
}

/** Flame height scale: the breath lengthens and shortens it a little. */
export function flameHeight(t: number, still: boolean): number {
  return still ? 1 : 1 + 0.07 * flameBreath(t) + 0.025 * flameFlicker(t)
}

/** Linear approach at `rate` per second: hover glows and the flame lean take 250 ms end to end. */
export function approach(value: number, target: number, rate: number, dt: number): number {
  const step = rate * dt
  return Math.abs(target - value) <= step + 1e-9 ? target : value + Math.sign(target - value) * step
}
