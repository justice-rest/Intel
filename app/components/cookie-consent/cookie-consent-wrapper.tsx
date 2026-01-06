"use client"

import { useEffect, useState } from "react"
import { CookieConsent } from "./cookie-consent"
import {
  saveConsentState,
  hasConsentDecision,
  CONSENT_CHANGED_EVENT,
} from "@/lib/consent"
import type { ConsentChoices } from "@/lib/consent"

/**
 * Cookie Consent Wrapper
 * Manages consent state and renders the cookie banner when needed
 */
export function CookieConsentWrapper() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already made a consent decision
    if (!hasConsentDecision()) {
      setShowBanner(true)
    }
  }, [])

  const logConsentToServer = async (choices: ConsentChoices) => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices }),
      })
    } catch (error) {
      // Fail silently - consent still works via localStorage
      console.error("Failed to log consent to server:", error)
    }
  }

  const handleAccept = () => {
    const choices: ConsentChoices = {
      essential: true,
      analytics: true,
      marketing: false,
    }

    // Save to localStorage
    saveConsentState(choices)

    // Log to server
    logConsentToServer(choices)

    // Dispatch custom event for same-tab listeners (PostHog)
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED_EVENT, {
        detail: { choices },
      })
    )

    setShowBanner(false)
  }

  const handleDecline = () => {
    const choices: ConsentChoices = {
      essential: true,
      analytics: false,
      marketing: false,
    }

    // Save to localStorage
    saveConsentState(choices)

    // Log to server
    logConsentToServer(choices)

    setShowBanner(false)
  }

  if (!showBanner) return null

  return <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />
}
