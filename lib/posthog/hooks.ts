'use client'

import { usePostHog } from 'posthog-js/react'
import { useCallback } from 'react'

/**
 * Custom hook for accessing PostHog instance in React components
 * Provides a safe way to interact with PostHog with built-in checks
 */
export function useAnalytics() {
  const posthog = usePostHog()

  const isAvailable = useCallback(() => {
    return !!posthog && !!process.env.NEXT_PUBLIC_POSTHOG_KEY
  }, [posthog])

  const track = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      if (!isAvailable()) return
      posthog?.capture(eventName, properties)
    },
    [posthog, isAvailable]
  )

  const identify = useCallback(
    (userId: string, properties?: Record<string, any>) => {
      if (!isAvailable()) return
      posthog?.identify(userId, properties)
    },
    [posthog, isAvailable]
  )

  const reset = useCallback(() => {
    if (!isAvailable()) return
    posthog?.reset()
  }, [posthog, isAvailable])

  const setPersonProperties = useCallback(
    (properties: Record<string, any>) => {
      if (!isAvailable()) return
      posthog?.setPersonProperties(properties)
    },
    [posthog, isAvailable]
  )

  return {
    posthog,
    isAvailable: isAvailable(),
    track,
    identify,
    reset,
    setPersonProperties,
  }
}

/**
 * Hook for tracking feature flags
 */
export function useFeatureFlag(flagKey: string) {
  const posthog = usePostHog()

  if (!posthog || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return undefined
  }

  return posthog.getFeatureFlag(flagKey)
}

/**
 * Hook for checking if a feature flag is enabled
 */
export function useIsFeatureEnabled(flagKey: string): boolean {
  const posthog = usePostHog()

  if (!posthog || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return false
  }

  return posthog.isFeatureEnabled(flagKey) || false
}
