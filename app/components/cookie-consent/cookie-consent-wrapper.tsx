"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { CookieConsent } from "./cookie-consent"
import {
  saveConsentState,
  hasConsentDecision,
  clearConsentState,
  CONSENT_CHANGED_EVENT,
} from "@/lib/consent"
import type { ConsentChoices } from "@/lib/consent"
import { useUser } from "@/lib/user-store/provider"

/**
 * Cookie Consent Wrapper
 * Manages consent state and renders the cookie banner when needed
 * - For logged-in users: checks database for user-specific consent
 * - For anonymous users: uses localStorage
 * - Clears localStorage when user changes (logout or switch accounts)
 */
export function CookieConsentWrapper() {
  const [showBanner, setShowBanner] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const { user } = useUser()
  const previousUserIdRef = useRef<string | null>(null)

  const checkUserConsent = useCallback(async () => {
    setIsChecking(true)
    const currentUserId = user?.id || null
    const previousUserId = previousUserIdRef.current

    // Detect user change (login, logout, or account switch)
    const userChanged = previousUserId !== null && previousUserId !== currentUserId
    if (userChanged) {
      // Clear localStorage when user changes to prevent consent leakage
      clearConsentState()
    }

    // Update the ref for next comparison
    previousUserIdRef.current = currentUserId

    if (currentUserId) {
      // Logged-in user: check database for their consent
      try {
        const response = await fetch("/api/consent")
        const data = await response.json()

        if (data.choices && data.source === "database") {
          // User has consent in database - don't show banner
          // Also sync to localStorage for PostHog
          saveConsentState(data.choices)
          setShowBanner(false)
        } else {
          // User has no consent in database - show banner
          setShowBanner(true)
        }
      } catch (error) {
        console.error("Failed to fetch user consent:", error)
        // On error, show banner to be safe (user can consent again)
        setShowBanner(true)
      }
    } else {
      // Anonymous user: use localStorage
      // But if they just logged out, localStorage was cleared above
      setShowBanner(!hasConsentDecision())
    }

    setIsChecking(false)
  }, [user?.id])

  // Check consent when component mounts or user changes
  useEffect(() => {
    checkUserConsent()
  }, [checkUserConsent])

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

    // Log to server (will associate with user_id if logged in)
    logConsentToServer(choices)

    setShowBanner(false)
  }

  // Don't render anything while checking or if banner shouldn't show
  if (isChecking || !showBanner) return null

  return <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />
}
