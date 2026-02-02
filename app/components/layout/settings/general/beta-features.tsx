"use client"

import { Switch } from "@/components/ui/switch"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { useSubscriptionPlan } from "@/lib/subscription/hooks"
import { Flask } from "@phosphor-icons/react"

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flask className="text-purple-500 size-5" weight="duotone" />
          <div>
            <h3 className="text-sm font-medium">Beta Features</h3>
            <p className="text-muted-foreground text-xs">
              Enable experimental features for advanced research
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.betaFeaturesEnabled}
          onCheckedChange={setBetaFeaturesEnabled}
        />
      </div>

      {preferences.betaFeaturesEnabled && (
        <div className="bg-muted/50 rounded-md p-3 text-xs space-y-2">
          <p className="font-medium text-purple-600 dark:text-purple-400">
            Beta features enabled:
          </p>
          <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
            <li>
              <span className="font-medium">Gemini Grounded Search</span> - Google&apos;s
              native search with inline citations
            </li>
            <li>
              <span className="font-medium">Ultra Research Mode</span> - Comprehensive
              multi-step research using LinkUp&apos;s research endpoint
            </li>
          </ul>
          <p className="text-muted-foreground/80 italic mt-2">
            These features are experimental and may change or be removed.
          </p>
        </div>
      )}
    </div>
  )
}
