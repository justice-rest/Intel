import { useCallback } from "react"
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
 * - /settings, /settings/[tab], /settings/[tab]#[section] → Opens settings
 */
export function useSlashCommands() {
  const { processSettingsCommand } = useSettingsCommand()

  const processSlashCommand = useCallback(
    (message: string): SlashCommandResult => {
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
    [processSettingsCommand]
  )

  return { processSlashCommand }
}
