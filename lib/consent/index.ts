export {
  getConsentState,
  saveConsentState,
  clearConsentState,
  hasAnalyticsConsent,
  hasConsentDecision,
  hashIpAddress,
} from "./consent-logger"

export {
  type ConsentChoices,
  type ConsentRecord,
  type ConsentState,
  CONSENT_VERSION,
  CONSENT_STORAGE_KEY,
  CONSENT_CHANGED_EVENT,
  DEFAULT_CHOICES,
} from "./types"
