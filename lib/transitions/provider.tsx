"use client"

import { TransitionRouter } from "next-transition-router"
import { gsap, initializeGSAP } from "./gsap-config"
import { DURATION, EASING, prefersReducedMotion } from "./animation-config"

// Ensure GSAP is initialized
initializeGSAP()

/**
 * Get the transition target element
 * Targets the main content area for smooth page transitions
 */
function getTransitionTarget(): HTMLElement | null {
  return document.querySelector("main")
}

/**
 * TransitionProvider - Smooth page transitions using GSAP
 *
 * Uses next-transition-router for App Router compatibility.
 * Premium fade transitions for all navigation - simple, fast, polished.
 *
 * Features:
 * - Consistent smooth fade for ALL page transitions
 * - Fast exit (0.15s) + smooth enter (0.25s) = premium feel
 * - Respects prefers-reduced-motion
 * - Cleanup functions prevent memory leaks
 * - Safe fallbacks ensure content is never left invisible
 */
export function TransitionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TransitionRouter
      auto
      leave={(next) => {
        // Respect reduced motion preference or skip if no target
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const target = getTransitionTarget()

        // If no main element (e.g., batch pages), skip animation
        if (!target) {
          next()
          return () => {}
        }

        // Simple, fast fade out
        const tween = gsap.to(target, {
          opacity: 0,
          duration: DURATION.leave,
          ease: EASING.leave,
          onComplete: next,
        })

        return () => {
          tween.kill()
          // Safety: ensure element is visible if animation was interrupted
          if (target) {
            gsap.set(target, { opacity: 1 })
          }
        }
      }}
      enter={(next) => {
        // Respect reduced motion preference
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const target = getTransitionTarget()

        // If no main element, just proceed
        if (!target) {
          next()
          return () => {}
        }

        // Scroll to top during transition
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })

        // Set initial state BEFORE animation
        gsap.set(target, { opacity: 0 })

        // Smooth fade in
        const tween = gsap.to(target, {
          opacity: 1,
          duration: DURATION.enter,
          ease: EASING.enter,
          onComplete: next,
        })

        return () => {
          tween.kill()
          // Safety: ALWAYS ensure element is visible after cleanup
          if (target) {
            gsap.set(target, { opacity: 1, clearProps: "opacity" })
          }
        }
      }}
    >
      {children}
    </TransitionRouter>
  )
}

export default TransitionProvider
