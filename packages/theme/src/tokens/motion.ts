/**
 * Motion tokens.
 *
 * Deliberately dependency-free — plain numbers and readonly tuples, no imports.
 * That keeps `@towing/theme` free of any animation library, so the driver app
 * (which ships no motion) is unaffected, and so `tokens.web.ts` can re-export
 * these to the web console unchanged.
 *
 * These are *perceptual* constants, not spatial ones, so they are excluded from
 * `scaleTokens()` for the same reason as `radii`: 240ms reads as 240ms on a
 * 360dp phone and on a 430dp phone. Distances *inside* an animation should
 * still be scaled at the call site via `theme.scale()`.
 */

/** Cubic-bezier control points, ready for RN `Easing.bezier(...)` or CSS. */
export type EasingCurve = readonly [number, number, number, number];

export const duration = {
  /** Press-in / press-out. Below ~100ms reads as instant, above ~150ms as lag. */
  micro: 120,
  /** Icon and label crossfades, hairline reveal, the exiting half of a swap. */
  fast: 180,
  /** The default. Enter/exit, tab scene change, skeleton to content. */
  base: 240,
  /** Sheet snap and dismiss. */
  slow: 320,
  /** First-paint hero only. Never for anything the user repeats. */
  slower: 420,
} as const;

export const easing = {
  /** Default. Decisive start, long soft tail. */
  standard: [0.2, 0.0, 0.0, 1.0] as EasingCurve,
  /** Entering / appearing. Nothing on the way in should ease *in*. */
  decelerate: [0.0, 0.0, 0.0, 1.0] as EasingCurve,
  /** Exiting / disappearing. Leaves fast, never lingers. */
  accelerate: [0.3, 0.0, 1.0, 1.0] as EasingCurve,
  /** For the one thing on screen you want looked at. */
  emphasized: [0.05, 0.7, 0.1, 1.0] as EasingCurve,
  linear: [0.0, 0.0, 1.0, 1.0] as EasingCurve,
} as const;

/**
 * Spring configs for `withSpring`.
 *
 * Physical (mass / stiffness / damping) rather than duration-based, so a
 * gesture can interrupt and retarget one mid-flight without a discontinuity.
 * That is the whole reason a dragged sheet feels alive and a duration-based
 * one does not.
 *
 * damping ratio  ζ = damping / (2 * sqrt(stiffness * mass))
 * settle time      ≈ 4 / (ζ * sqrt(stiffness / mass))
 */
export const spring = {
  /** ζ≈0.85, ~160ms, no perceptible overshoot. Press feedback. */
  press: { mass: 0.6, stiffness: 520, damping: 30 },
  /** ζ≈0.81, ~250ms, ~3% overshoot. Tab pill, chips, segmented controls. */
  snappy: { mass: 0.8, stiffness: 320, damping: 26 },
  /** ζ≈0.85, ~330ms, ~1% overshoot. Bottom sheets and other large surfaces. */
  smooth: { mass: 1.0, stiffness: 200, damping: 24 },
  /** ζ≈0.59, ~400ms, ~10% overshoot. Confirmation and success only. */
  bouncy: { mass: 0.9, stiffness: 260, damping: 18 },
  /** ζ≈0.91, ~400ms, no overshoot. Slow settles and dismissals. */
  gentle: { mass: 1.0, stiffness: 120, damping: 20 },
} as const;

/** Press-scale targets. The bigger the element, the smaller the scale delta. */
export const pressScale = {
  chip: 0.92,
  button: 0.97,
  card: 0.98,
  row: 0.99,
} as const;

export const motion = { duration, easing, spring, pressScale } as const;

export type Motion = typeof motion;
export type DurationKey = keyof typeof duration;
export type EasingKey = keyof typeof easing;
export type SpringKey = keyof typeof spring;
