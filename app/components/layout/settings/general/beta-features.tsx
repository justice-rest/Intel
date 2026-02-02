"use client"

import { Button } from "@/components/ui/button"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useSubscriptionPlan } from "@/lib/subscription/hooks"
import { Flask, X } from "@phosphor-icons/react"

/**
 * BetaFeatures toggle component for Settings > General tab
 *
 * IMPORTANT: This component is ONLY visible to Scale plan users.
 * Beta features include:
 * - Gemini Grounded Search (Google's native search with citations)
 * - Ultra Research Mode (LinkUp's /research endpoint)
 *
 * The toggle is enforced at multiple levels:
 * 1. UI level: Component hidden for non-Scale users
 * 2. API level: Tools only registered if user has Scale plan + beta enabled
 */
export function BetaFeatures() {
  const { preferences, setBetaFeaturesEnabled } = useUserPreferences()
  const { isScale, isLoading } = useSubscriptionPlan()

  // Only show for Scale plan users
  // Return null during loading to prevent flash of content
  if (isLoading || !isScale) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium">Beta features</h3>
        <p className="text-muted-foreground text-xs">
          Enable experimental research features
        </p>
      </div>
      {preferences.betaFeaturesEnabled ? (
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center justify-center gap-2 h-9 min-w-[105px] px-4 shrink-0"
          onClick={() => setBetaFeaturesEnabled(false)}
        >
          <X className="size-4" />
          <span>Disable</span>
        </Button>
      ) : (
        <Button
          size="sm"
          className="flex items-center justify-center gap-2 h-9 min-w-[105px] px-4 shrink-0 bg-purple-600 text-white hover:bg-purple-700"
          onClick={() => setBetaFeaturesEnabled(true)}
        >
          <Flask className="size-4" />
          <span>Enable</span>
        </Button>
      )}
    </div>
  )
}
