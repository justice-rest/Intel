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
  "subscription",
  "crms",
  "data",
  "memory",
  "knowledge",
]

/**
 * Hook for handling /settings slash commands
 *
 * Supported formats:
 * - /settings → Opens general tab
 * - /settings/subscription → Opens subscription tab
 * - /settings/crms → Opens CRMs tab (CRM connections)
 * - /settings/data → Opens data tab (RAG documents)
 * - /settings/memory → Opens memory tab (AI memory)
 * - /settings/knowledge → Opens knowledge tab (Knowledge profiles, connectors)
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

      // Resolve tab: check valid tabs, default to general
      let tab: TabType = "general"
      if (tabParam && VALID_TABS.includes(tabParam as TabType)) {
        tab = tabParam as TabType
      }

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
