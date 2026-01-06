'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, useState, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getConsentState, CONSENT_CHANGED_EVENT } from '@/lib/consent'

/**
 * PostHog Analytics Provider
 * Wraps the app to enable analytics tracking throughout Rōmy
 * Only initializes if user has given analytics consent
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)

  const initializePostHog = useCallback(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

    // Only initialize if API key is provided and not already initialized
    if (apiKey && !posthog.__loaded) {
      try {
        posthog.init(apiKey, {
          api_host: apiHost,
          person_profiles: 'identified_only', // Only create profiles for logged-in users
          capture_pageview: false, // We handle pageviews manually for better control
          capture_pageleave: true, // Track when users leave pages
          autocapture: {
            dom_event_allowlist: ['click', 'submit'], // Only capture clicks and form submits
            element_allowlist: ['button', 'a'], // Focus on important interactions
          },
          // Enable session recording only if explicitly configured
          disable_session_recording: process.env.NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS !== 'true',
          loaded: (posthog) => {
            // Enable debug mode in development
            if (process.env.NODE_ENV === 'development') {
              posthog.debug()
            }
            setIsInitialized(true)
          },
        })
      } catch (error) {
        console.error('PostHog initialization failed:', error)
        // Fail silently - analytics should never break the app
      }
    }
  }, [])

  useEffect(() => {
    // Only initialize on client-side
    if (typeof window === 'undefined' || isInitialized) return

    // Check if user has given analytics consent
    const consentState = getConsentState()
    if (consentState?.choices?.analytics) {
      initializePostHog()
    }

    // Listen for consent changes (when user accepts cookies in same tab)
    const handleConsentChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ choices: { analytics: boolean } }>
      if (customEvent.detail?.choices?.analytics && !isInitialized) {
        initializePostHog()
      }
    }

    window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChange)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChange)
  }, [isInitialized, initializePostHog])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

/**
 * PostHog Pageview Tracker
 * Automatically tracks pageviews and page changes in app router
 */
export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only track if PostHog is initialized and we have a valid pathname
    if (pathname && posthog && posthog.__loaded) {
      try {
        let url = window.origin + pathname
        if (searchParams && searchParams.toString()) {
          url = url + `?${searchParams.toString()}`
        }

        // Track pageview with additional context
        posthog.capture('$pageview', {
          $current_url: url,
        })
      } catch (error) {
        // Fail silently - analytics should never break the app
        console.error('PostHog pageview tracking failed:', error)
      }
    }
  }, [pathname, searchParams])

  return null
}
