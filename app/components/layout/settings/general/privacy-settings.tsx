"use client"

import { Switch } from "@/components/ui/switch"
import { useEffect, useState } from "react"
import { Cookie, ChartBar, ShieldCheck, CaretDown } from "@phosphor-icons/react"
import {
  getConsentState,
  saveConsentState,
  CONSENT_CHANGED_EVENT,
} from "@/lib/consent"
import type { ConsentChoices } from "@/lib/consent"
import { useUser } from "@/lib/user-store/provider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export function PrivacySettings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 rounded-md text-left transition-colors hover:bg-muted/50 -mx-2 px-2 py-1.5"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Privacy & Cookies</h3>
            <p className="text-muted-foreground text-xs">
              Manage how we use cookies and collect data
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="text-muted-foreground size-4" />
            <CaretDown
              className={cn(
                "text-muted-foreground size-3.5 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up-1 data-[state=open]:slide-down-1">
        <div className="space-y-3 pt-3">
          {/* Essential cookies - always on */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Cookie className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="text-sm">Essential cookies</span>
                <p className="text-muted-foreground text-xs">
                  Required for the site to function
                </p>
              </div>
            </div>
            <Switch checked={true} disabled className="shrink-0" />
          </div>

          {/* Analytics cookies - toggleable */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ChartBar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="text-sm">Analytics cookies</span>
                <p className="text-muted-foreground text-xs">
                  Help us improve by tracking usage patterns
                </p>
              </div>
            </div>
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={handleToggle}
              disabled={isLoading}
              className="shrink-0"
            />
          </div>

          <p className="text-muted-foreground text-xs">
            We respect your privacy. See our{" "}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
