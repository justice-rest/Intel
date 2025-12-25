"use client"

import { startTransition } from "react"
import { TransitionRouter } from "next-transition-router"
import { gsap, initializeGSAP } from "./gsap-config"
import { DURATION, EASING, prefersReducedMotion } from "./animation-config"

// Ensure GSAP is initialized
initializeGSAP()

// CSS ID for the transition container
const TRANSITION_CONTAINER_ID = "page-transition-container"

/**
 * Get the transition target element
 * Targets the entire page container to include sidebar in transitions
 */
function getTransitionTarget(): HTMLElement | null {
  return document.getElementById(TRANSITION_CONTAINER_ID)
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
 * - Animates entire page container (including sidebar)
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
      <div
        id={TRANSITION_CONTAINER_ID}
        className="transition-container"
      >
        {children}
      </div>
    </TransitionRouter>
  )
}

export default TransitionProvider
