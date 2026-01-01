import { useState, useCallback, useMemo, useEffect } from "react"
import {
  GearSixIcon,
  CreditCardIcon,
  LinkSimple,
  PaintBrushIcon,
  DatabaseIcon,
  HardDrives,
  FileTextIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export interface SlashCommand {
  id: string
  command: string
  label: string
  description: string
  icon: Icon
  keywords: string[] // For fuzzy matching
}

// Command registry - all available slash commands
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "settings",
    command: "/settings",
    label: "Settings",
    description: "Open settings",
    icon: GearSixIcon,
    keywords: ["settings", "preferences", "options", "config"],
  },
  {
    id: "settings-general",
    command: "/settings/general",
    label: "General Settings",
    description: "Account & profile settings",
    icon: GearSixIcon,
    keywords: ["general", "account", "profile", "settings"],
  },
  {
    id: "settings-subscription",
    command: "/settings/subscription",
    label: "Subscription",
    description: "Manage your subscription",
    icon: CreditCardIcon,
    keywords: ["subscription", "billing", "plan", "upgrade", "payment"],
  },
  {
    id: "settings-integrations",
    command: "/settings/integrations",
    label: "Integrations",
    description: "CRMs, Google & Notion",
    icon: LinkSimple,
    keywords: ["integrations", "crm", "connect", "bloomerang", "neon", "virtuous", "google", "gmail", "drive", "notion"],
  },
  {
    id: "settings-appearance",
    command: "/settings/appearance",
    label: "Appearance",
    description: "Theme & layout preferences",
    icon: PaintBrushIcon,
    keywords: ["appearance", "theme", "dark", "light", "layout"],
  },
  {
    id: "settings-data",
    command: "/settings/data",
    label: "Data",
    description: "Manage documents & files",
    icon: DatabaseIcon,
    keywords: ["data", "documents", "files", "upload"],
  },
  {
    id: "settings-memory",
    command: "/settings/memory",
    label: "Memory",
    description: "AI memory settings",
    icon: HardDrives,
    keywords: ["memory", "ai", "remember", "context"],
  },
  {
    id: "draft",
    command: "/draft",
    label: "Drafts",
    description: "Open email drafts",
    icon: FileTextIcon,
    keywords: ["draft", "drafts", "email", "gmail"],
  },
]

interface UseSlashCommandMenuOptions {
  inputValue: string
  onSelectCommand: (command: string) => void
}

interface UseSlashCommandMenuReturn {
  isOpen: boolean
  query: string
  hasQuery: boolean // Whether user has typed beyond just "/"
  selectedIndex: number
  filteredCommands: SlashCommand[]
  handleKeyDown: (e: React.KeyboardEvent) => boolean // Returns true if event was handled
  selectCommand: (command: SlashCommand) => void
  setSelectedIndex: (index: number) => void
  close: () => void
}

/**
 * Hook for managing the slash command menu state and behavior
 */
export function useSlashCommandMenu({
  inputValue,
  onSelectCommand,
}: UseSlashCommandMenuOptions): UseSlashCommandMenuReturn {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Check if input starts with / and extract the query
  const isSlashCommand = inputValue.trim().startsWith("/")
  const query = isSlashCommand ? inputValue.trim().slice(1).toLowerCase() : ""

  // Menu is open when there's a slash command being typed
  const isOpen = isSlashCommand && inputValue.trim().length >= 1

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) {
      // Show all commands when just "/" is typed
      return SLASH_COMMANDS
    }

    // Filter by command match or keyword match
    return SLASH_COMMANDS.filter((cmd) => {
      const commandWithoutSlash = cmd.command.slice(1).toLowerCase()
      const queryLower = query.toLowerCase()

      // Match command (e.g., "settings/sub" matches "/settings/subscription")
      if (commandWithoutSlash.includes(queryLower)) {
        return true
      }

      // Match keywords
      if (cmd.keywords.some((kw) => kw.includes(queryLower))) {
        return true
      }

      // Match label
      if (cmd.label.toLowerCase().includes(queryLower)) {
        return true
      }

      return false
    })
  }, [query])

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands.length])

  // Select a command and trigger the callback
  const selectCommand = useCallback(
    (command: SlashCommand) => {
      onSelectCommand(command.command)
    },
    [onSelectCommand]
  )

  // Close the menu (when escape is pressed or clicking outside)
  const close = useCallback(() => {
    // This is handled by the parent - just clears the input or moves focus
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || filteredCommands.length === 0) {
        return false
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          return true

        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          return true

        case "Enter":
          // Enter executes the selected command
          if (filteredCommands[selectedIndex]) {
            e.preventDefault()
            selectCommand(filteredCommands[selectedIndex])
            return true
          }
          return false

        case "Escape":
          e.preventDefault()
          // Let parent handle escape (clear input or close)
          return true

        default:
          return false
      }
    },
    [isOpen, filteredCommands, selectedIndex, selectCommand]
  )

  return {
    isOpen,
    query,
    hasQuery: query.length > 0,
    selectedIndex,
    filteredCommands,
    handleKeyDown,
    selectCommand,
    setSelectedIndex,
    close,
  }
}
