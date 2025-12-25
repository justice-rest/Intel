"use client"

import gsap from "gsap"

/**
 * Centralized GSAP configuration
 *
 * This file ensures GSAP is configured once and plugins are registered only once.
 * Import this before using GSAP anywhere in the app to prevent memory leaks
 * and ensure consistent behavior across route changes.
 *
 * Best practice for Next.js 15 App Router:
 * @see https://gsap.com/resources/React
 */

// Track if GSAP has been initialized
let gsapInitialized = false

/**
 * Initialize GSAP with default settings
 * Safe to call multiple times - will only initialize once
 */
export function initializeGSAP(): void {
  if (gsapInitialized) return

  // Configure GSAP defaults for optimal performance
  gsap.defaults({
    ease: "power2.out",
    duration: 0.4,
  })

  // Configure ticker for React 18+ concurrent mode
  gsap.ticker.lagSmoothing(0)

  gsapInitialized = true
}

/**
 * Kill all GSAP animations targeting a specific element
 * Use this for cleanup in useEffect/useLayoutEffect
 */
export function killAnimations(target: gsap.TweenTarget): void {
  gsap.killTweensOf(target)
}

/**
 * Create a scoped context for component animations
 * Automatically cleans up when component unmounts
 */
export function createGSAPContext(
  scope: Element | null,
  callback: (context: gsap.Context) => void
): gsap.Context {
  const ctx = gsap.context(callback, scope || undefined)
  return ctx
}

// Auto-initialize on module load
initializeGSAP()

export { gsap }
