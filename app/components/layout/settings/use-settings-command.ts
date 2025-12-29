import { useCallback } from "react"
import type { TabType } from "./settings-content"

interface SettingsCommandResult {
  isCommand: boolean
  handled: boolean
}

// Valid tabs that can be targeted via slash commands
const VALID_TABS: TabType[] = [
  "general",
  "appearance",
  "data",
  "memory",
  "subscription",
  "integrations",
  "connections",
]

/**
 * Hook for handling /settings slash commands
 *
 * Supported formats:
 * - /settings → Opens general tab
 * - /settings/subscription → Opens subscription tab
 * - /settings/integrations → Opens integrations tab (includes CRMs, Google, Notion)
 */
export function useSettingsCommand() {
  const processSettingsCommand = useCallback(
    (message: string): SettingsCommandResult => {
      const trimmed = message.trim().toLowerCase()

      // Check if it starts with /settings
      if (!trimmed.startsWith("/settings")) {
        return { isCommand: false, handled: false }
      }

      // Parse the command: /settings, /settings/, /settings/tab, or /settings/tab#section
      // Regex: /settings followed by optional /tab and optional #section
      // Note: trailing slash without tab is allowed (treated as /settings)
      const commandMatch = trimmed.match(
        /^\/settings(?:\/([a-z]*))?(?:#([a-z0-9-]+))?$/
      )

      if (!commandMatch) {
        // Invalid format, but it is a /settings command attempt
        // Return handled: false so user sees it's not recognized
        return { isCommand: true, handled: false }
      }

      const [, tabParam, sectionParam] = commandMatch

      // Default to "general" if no tab specified, validate tab name
      const tab: TabType =
        tabParam && VALID_TABS.includes(tabParam as TabType)
          ? (tabParam as TabType)
          : "general"

      // Dispatch the open-settings event with tab and section
      window.dispatchEvent(
        new CustomEvent("open-settings", {
          detail: {
            tab,
            section: sectionParam || undefined,
          },
        })
      )

      return { isCommand: true, handled: true }
    },
    []
  )

  return { processSettingsCommand }
}
