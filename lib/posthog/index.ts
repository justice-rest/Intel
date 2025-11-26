/**
 * PostHog Analytics Integration for Rōmy
 *
 * This module provides centralized analytics tracking using PostHog.
 *
 * Setup:
 * 1. Add NEXT_PUBLIC_POSTHOG_KEY to your environment variables
 * 2. Optionally set NEXT_PUBLIC_POSTHOG_HOST (defaults to US cloud)
 * 3. Optionally enable session recordings with NEXT_PUBLIC_POSTHOG_ENABLE_RECORDINGS=true
 *
 * Usage:
 * - Import event tracking functions from './events'
 * - Use the useAnalytics() hook in React components
 * - All tracking is automatically disabled if PostHog is not configured
 */

export * from './events'
export * from './hooks'
export { PostHogProvider, PostHogPageView } from './provider'
