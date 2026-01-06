import { createHash } from "crypto"
import {
  ConsentChoices,
  ConsentState,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_CHOICES,
} from "./types"

/**
 * Hash an IP address for compliance logging (not tracking)
 * Uses SHA-256 with a salt to prevent reverse lookup
 */
export function hashIpAddress(ip: string): string {
  const salt = process.env.CSRF_SECRET || "consent-salt"
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex")
}

/**
 * Get consent state from localStorage (client-side only)
 */
export function getConsentState(): ConsentState | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!stored) return null

    const state = JSON.parse(stored) as ConsentState
    // Validate structure
    if (
      typeof state.hasConsented !== "boolean" ||
      typeof state.choices !== "object"
    ) {
      return null
    }
    return state
  } catch {
    return null
  }
}

/**
 * Save consent state to localStorage (client-side only)
 */
export function saveConsentState(choices: ConsentChoices): ConsentState {
  const state: ConsentState = {
    hasConsented: true,
    choices: {
      ...DEFAULT_CHOICES,
      ...choices,
      essential: true, // Always force essential to true
    },
    consentedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
  }

  return state
}

/**
 * Clear consent state (for testing or user request)
 */
export function clearConsentState(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CONSENT_STORAGE_KEY)
  }
}

/**
 * Check if analytics consent has been given
 */
export function hasAnalyticsConsent(): boolean {
  const state = getConsentState()
  return state?.choices?.analytics ?? false
}

/**
 * Check if user has made a consent choice (regardless of what they chose)
 */
export function hasConsentDecision(): boolean {
  const state = getConsentState()
  return state?.hasConsented ?? false
}
