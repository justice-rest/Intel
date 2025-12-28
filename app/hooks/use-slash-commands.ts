import { useCallback } from "react"
import { useSlashCommand as useDraftsCommand } from "@/app/components/drafts"
import { useSettingsCommand } from "@/app/components/layout/settings/use-settings-command"

interface SlashCommandResult {
  isCommand: boolean
  handled: boolean
}

/**
 * Composite hook that combines all slash command handlers.
 * Add new command handlers here as they are created.
 *
 * Supported commands:
 * - /draft, /drafts → Opens drafts modal
 * - /settings, /settings/[tab], /settings/[tab]#[section] → Opens settings
 */
export function useSlashCommands() {
  const { processSlashCommand: processDraftsCommand } = useDraftsCommand()
  const { processSettingsCommand } = useSettingsCommand()

  const processSlashCommand = useCallback(
    (message: string): SlashCommandResult => {
      // Try drafts command first (most common)
      const draftsResult = processDraftsCommand(message)
      if (draftsResult.handled) {
        return draftsResult
      }

      // Try settings command
      const settingsResult = processSettingsCommand(message)
      if (settingsResult.handled) {
        return settingsResult
      }

      // If message starts with /, it's an unrecognized command
      if (message.trim().startsWith("/")) {
        return { isCommand: true, handled: false }
      }

      return { isCommand: false, handled: false }
    },
    [processDraftsCommand, processSettingsCommand]
  )

  return { processSlashCommand }
}
