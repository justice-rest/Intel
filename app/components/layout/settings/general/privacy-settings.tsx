"use client"

import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"
import {
  getConsentState,
  saveConsentState,
  CONSENT_CHANGED_EVENT,
} from "@/lib/consent"
import type { ConsentChoices } from "@/lib/consent"
import { useUser } from "@/lib/user-store/provider"

export function PrivacySettings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useUser()

  // Load current consent state
  useEffect(() => {
    const loadConsent = async () => {
      setIsLoading(true)

      if (user?.id) {
        // Logged-in user: fetch from database
        try {
          const response = await fetch("/api/consent")
          const data = await response.json()
          if (data.choices) {
            setAnalyticsEnabled(data.choices.analytics ?? false)
          } else {
            // No consent record - default to false
            setAnalyticsEnabled(false)
          }
        } catch (error) {
          console.error("Failed to fetch consent:", error)
          // Fall back to localStorage
          const localConsent = getConsentState()
          setAnalyticsEnabled(localConsent?.choices?.analytics ?? false)
        }
      } else {
        // Anonymous user: use localStorage
        const localConsent = getConsentState()
        setAnalyticsEnabled(localConsent?.choices?.analytics ?? false)
      }

      setIsLoading(false)
    }

    loadConsent()
  }, [user?.id])

  const handleToggle = async (enabled: boolean) => {
    setAnalyticsEnabled(enabled)

    const choices: ConsentChoices = {
      essential: true,
      analytics: enabled,
      marketing: false,
    }

    // Save to localStorage
    saveConsentState(choices)

    // Save to database
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices }),
      })
    } catch (error) {
      console.error("Failed to save consent:", error)
    }

    // Dispatch event for PostHog to react
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED_EVENT, {
        detail: { choices },
      })
    )
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium">Analytics cookies</h3>
        <p className="text-muted-foreground text-xs">
          Help us improve by tracking usage patterns
        </p>
      </div>
      <Switch
        checked={analyticsEnabled}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className="shrink-0"
      />
    </div>
  )
}
