"use client"

import { startTransition } from "react"
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
  // Target main element for content transitions
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
 * - Uses React's startTransition for better performance
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
        // Respect reduced motion preference
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const target = getTransitionTarget()

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

        // Return cleanup function
        return () => {
          tween.kill()
        }
      }}
      enter={(next) => {
        // Respect reduced motion preference
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const target = getTransitionTarget()

        if (!target) {
          next()
          return () => {}
        }

        // Scroll to top during transition (instant scroll while faded out)
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })

        // Use requestAnimationFrame for optimal timing
        let tween: gsap.core.Tween

        requestAnimationFrame(() => {
          // Set initial state
          gsap.set(target, { opacity: 0 })

          // Smooth fade in
          tween = gsap.to(target, {
            opacity: 1,
            duration: DURATION.enter,
            ease: EASING.enter,
            onComplete: () => {
              startTransition(next)
            },
          })
        })

        // Return cleanup function
        return () => {
          if (tween) {
            tween.kill()
          }
        }
      }}
    >
      {children}
    </TransitionRouter>
  )
}

export default TransitionProvider
