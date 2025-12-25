"use client"

import { startTransition } from "react"
import { TransitionRouter } from "next-transition-router"
import { gsap, initializeGSAP } from "./gsap-config"
import {
  DURATION,
  EASING,
  getTransitionType,
  prefersReducedMotion,
} from "./animation-config"

// Ensure GSAP is initialized
initializeGSAP()

/**
 * TransitionProvider - Smooth page transitions using GSAP
 *
 * Uses next-transition-router for App Router compatibility.
 * Supports different transition types based on navigation paths.
 *
 * Features:
 * - Crossfade for general navigation
 * - Slide for chat-to-chat and batch-to-batch
 * - Scale for home <-> batch transitions
 * - Respects prefers-reduced-motion
 * - Cleanup functions prevent memory leaks
 * - Uses React's startTransition for better performance
 * - GPU-accelerated transforms
 */
export function TransitionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TransitionRouter
      auto
      leave={(next, from, to) => {
        // Respect reduced motion preference
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const transitionType = getTransitionType(from ?? "/", to ?? "/")
        const main = document.querySelector("main")

        if (!main) {
          next()
          return () => {}
        }

        // Create the leave animation based on transition type
        // Using force3D for GPU acceleration
        let tween: gsap.core.Tween

        switch (transitionType) {
          case "slide":
            tween = gsap.to(main, {
              opacity: 0,
              x: -20,
              duration: DURATION.normal,
              ease: EASING.exit,
              force3D: true,
              onComplete: next,
            })
            break

          case "scale":
            tween = gsap.to(main, {
              opacity: 0,
              scale: 0.98,
              duration: DURATION.fast,
              ease: EASING.exit,
              force3D: true,
              onComplete: next,
            })
            break

          case "crossfade":
          default:
            tween = gsap.to(main, {
              opacity: 0,
              duration: DURATION.fast,
              ease: EASING.exit,
              onComplete: next,
            })
            break
        }

        // Return cleanup function
        return () => {
          tween.kill()
        }
      }}
      enter={(next, from, to) => {
        // Respect reduced motion preference
        if (prefersReducedMotion()) {
          next()
          return () => {}
        }

        const transitionType = getTransitionType(from ?? "/", to ?? "/")
        const main = document.querySelector("main")

        if (!main) {
          next()
          return () => {}
        }

        // Scroll to top during transition (instant scroll while faded out)
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })

        // Create the enter animation based on transition type
        // Use requestAnimationFrame for optimal timing
        let tween: gsap.core.Tween

        requestAnimationFrame(() => {
          switch (transitionType) {
            case "slide":
              // Set initial state
              gsap.set(main, { opacity: 0, x: 20 })
              tween = gsap.to(main, {
                opacity: 1,
                x: 0,
                duration: DURATION.normal,
                ease: EASING.enter,
                force3D: true,
                clearProps: "x,transform",
                onComplete: () => {
                  startTransition(next)
                },
              })
              break

            case "scale":
              // Set initial state
              gsap.set(main, { opacity: 0, scale: 0.98 })
              tween = gsap.to(main, {
                opacity: 1,
                scale: 1,
                duration: DURATION.slow,
                ease: EASING.premium,
                force3D: true,
                clearProps: "scale,transform",
                onComplete: () => {
                  startTransition(next)
                },
              })
              break

            case "crossfade":
            default:
              // Set initial state
              gsap.set(main, { opacity: 0 })
              tween = gsap.to(main, {
                opacity: 1,
                duration: DURATION.slow,
                ease: EASING.enter,
                onComplete: () => {
                  startTransition(next)
                },
              })
              break
          }
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
