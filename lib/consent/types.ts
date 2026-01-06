export interface ConsentChoices {
  essential: boolean // Always true - required for site to function
  analytics: boolean // PostHog, etc.
  marketing: boolean // Future use
}

export interface ConsentRecord {
  id?: string
  user_id?: string // null for anonymous users
  ip_hash: string // SHA-256 hash of IP for compliance, not tracking
  consent_version: string // e.g., "1.0"
  choices: ConsentChoices
  user_agent?: string
  created_at?: string
}

export interface ConsentState {
  hasConsented: boolean
  choices: ConsentChoices
  consentedAt?: string
  version: string
}

export const CONSENT_VERSION = "1.0"
export const CONSENT_STORAGE_KEY = "romy_cookie_consent"
export const CONSENT_CHANGED_EVENT = "romy_consent_changed"

export const DEFAULT_CHOICES: ConsentChoices = {
  essential: true,
  analytics: false,
  marketing: false,
}
