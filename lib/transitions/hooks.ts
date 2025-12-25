"use client"

import {
  useTransitionRouter as useTransitionRouterBase,
  useTransitionState as useTransitionStateBase,
} from "next-transition-router"

/**
 * useTransitionRouter - Navigate with smooth transitions
 *
 * Use this instead of Next.js useRouter for navigation that should
 * include page transition animations.
 *
 * @example
 * const router = useTransitionRouter()
 * router.push('/batch')  // Navigates with animation
 *
 * @example
 * // Skip animation for specific navigation
 * const router = useTransitionRouter()
 * router.push('/batch', { skipTransition: true })
 */
export function useTransitionRouter() {
  return useTransitionRouterBase()
}

/**
 * useTransitionState - Track transition animation state
 *
 * Use this to react to transition state changes in your components.
 *
 * @returns {Object} Transition state
 * @returns {string} state.stage - 'none' | 'leaving' | 'entering'
 * @returns {boolean} state.isReady - Whether the page is ready for interaction
 *
 * @example
 * const { stage, isReady } = useTransitionState()
 *
 * if (stage === 'leaving') {
 *   // Hide interactive elements during exit animation
 * }
 */
export function useTransitionState() {
  return useTransitionStateBase()
}
