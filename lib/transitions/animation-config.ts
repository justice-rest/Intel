/**
 * Animation timing standards - fast and premium
 * Inspired by Linear, Stripe, Perplexity - simple, fast fades
 */
export const DURATION = {
  // Exit: fast fade out (don't make user wait)
  leave: 0.15,
  // Enter: slightly slower for perceived smoothness
  enter: 0.25,
} as const

/**
 * GSAP easing presets
 * Using smooth power curves for buttery transitions
 */
export const EASING = {
  // Smooth fade out
  leave: "power2.in",
  // Premium smooth fade in
  enter: "power2.out",
} as const

/**
 * Stagger delays for list animations
 */
export const STAGGER = {
  fast: 0.03,
  normal: 0.05,
  slow: 0.08,
} as const

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
