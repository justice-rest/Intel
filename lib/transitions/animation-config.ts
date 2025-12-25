/**
 * Animation timing standards - fast and responsive
 * Based on premium UX patterns for buttery smooth transitions
 */
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const

/**
 * GSAP easing presets
 * Using power curves for natural motion
 */
export const EASING = {
  // Standard ease out for entering elements
  enter: "power2.out",
  // Quick ease in for exiting elements
  exit: "power1.in",
  // Smooth ease for general use
  default: "power2.inOut",
  // Premium expo ease for hero animations
  premium: "expo.out",
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
 * Page transition configurations
 * Different transitions for different navigation types
 */
export const PAGE_TRANSITIONS = {
  // Default crossfade - fast and clean
  crossfade: {
    leave: {
      duration: DURATION.fast,
      ease: EASING.exit,
    },
    enter: {
      duration: DURATION.slow,
      ease: EASING.enter,
    },
  },

  // Slide transition for related pages (chat to chat)
  slide: {
    leave: {
      duration: DURATION.normal,
      ease: EASING.exit,
      x: -20,
    },
    enter: {
      duration: DURATION.normal,
      ease: EASING.enter,
      x: 0,
      fromX: 20,
    },
  },

  // Scale transition for modal-like pages
  scale: {
    leave: {
      duration: DURATION.fast,
      ease: EASING.exit,
      scale: 0.98,
    },
    enter: {
      duration: DURATION.normal,
      ease: EASING.premium,
      scale: 1,
      fromScale: 0.98,
    },
  },
} as const

/**
 * Route-based transition mapping
 * Determines which transition to use based on navigation paths
 */
export type TransitionType = keyof typeof PAGE_TRANSITIONS

export function getTransitionType(from: string, to: string): TransitionType {
  // Chat to chat navigation - use slide
  if (from.startsWith("/c/") && to.startsWith("/c/")) {
    return "slide"
  }

  // Batch job to batch job - use slide
  if (from.startsWith("/batch/") && to.startsWith("/batch/")) {
    return "slide"
  }

  // Home to batch or batch to home - scale
  if (
    (from === "/" && to.startsWith("/batch")) ||
    (from.startsWith("/batch") && to === "/")
  ) {
    return "scale"
  }

  // Default crossfade for all other navigations
  return "crossfade"
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
