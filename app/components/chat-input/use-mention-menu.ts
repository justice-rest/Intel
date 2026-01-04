import { useState, useCallback, useMemo, useEffect } from "react"
import { RobotIcon, UserCircleIcon, UsersIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export interface MentionTarget {
  id: string
  name: string
  displayName: string
  type: "ai" | "collaborator" | "everyone"
  icon: Icon
  profileImage?: string | null
  userId?: string
}

// AI mention targets
const AI_MENTIONS: MentionTarget[] = [
  {
    id: "ai",
    name: "Rōmy",
    displayName: "Rōmy",
    type: "ai",
    icon: RobotIcon,
  },
]

// Special mentions
const SPECIAL_MENTIONS: MentionTarget[] = [
  {
    id: "everyone",
    name: "everyone",
    displayName: "Everyone",
    type: "everyone",
    icon: UsersIcon,
  },
]

export interface Collaborator {
  user_id: string
  user: {
    display_name: string | null
    profile_image: string | null
  } | null
}

interface UseMentionMenuOptions {
  inputValue: string
  cursorPosition: number
  onSelectMention: (mention: MentionTarget) => void
  collaborators?: Collaborator[]
  isCollaborativeChat?: boolean
}

interface UseMentionMenuReturn {
  isOpen: boolean
  query: string
  selectedIndex: number
  filteredMentions: MentionTarget[]
  mentionStartPosition: number // Position where @ starts
  handleKeyDown: (e: React.KeyboardEvent) => boolean
  selectMention: (mention: MentionTarget) => void
  setSelectedIndex: (index: number) => void
  close: () => void
}

/**
 * Hook for managing the @mention menu state and behavior.
 * Detects when user types @ and shows available mention targets.
 */
export function useMentionMenu({
  inputValue,
  cursorPosition,
  onSelectMention,
  collaborators = [],
  isCollaborativeChat = false,
}: UseMentionMenuOptions): UseMentionMenuReturn {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Find the @ symbol position before the cursor
  const mentionContext = useMemo(() => {
    // Look backwards from cursor to find @
    const textBeforeCursor = inputValue.slice(0, cursorPosition)

    // Find the last @ that could start a mention
    // A mention starts after: start of string, space, or newline
    const atIndex = textBeforeCursor.lastIndexOf("@")

    if (atIndex === -1) {
      return { isActive: false, startPos: -1, query: "" }
    }

    // Check if @ is at start or after whitespace
    const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " "
    if (!/[\s\n]/.test(charBefore) && atIndex !== 0) {
      // @ is in the middle of a word, not a mention trigger
      return { isActive: false, startPos: -1, query: "" }
    }

    // Extract the query (text after @)
    const query = textBeforeCursor.slice(atIndex + 1)

    // Check if query contains spaces (completed mention or not a mention)
    if (query.includes(" ") || query.includes("\n")) {
      return { isActive: false, startPos: -1, query: "" }
    }

    return { isActive: true, startPos: atIndex, query: query.toLowerCase() }
  }, [inputValue, cursorPosition])

  const isOpen = mentionContext.isActive
  const query = mentionContext.query
  const mentionStartPosition = mentionContext.startPos

  // Build collaborator mention targets
  const collaboratorMentions = useMemo((): MentionTarget[] => {
    if (!isCollaborativeChat || collaborators.length === 0) {
      return []
    }

    return collaborators
      .filter((c) => c.user?.display_name)
      .map((c) => ({
        id: `collaborator-${c.user_id}`,
        name: c.user!.display_name!.toLowerCase().replace(/\s+/g, ""),
        displayName: c.user!.display_name!,
        type: "collaborator" as const,
        icon: UserCircleIcon,
        profileImage: c.user?.profile_image,
        userId: c.user_id,
      }))
  }, [collaborators, isCollaborativeChat])

  // Combine all mention targets
  const allMentions = useMemo(() => {
    const mentions: MentionTarget[] = [...AI_MENTIONS]

    if (isCollaborativeChat) {
      mentions.push(...SPECIAL_MENTIONS)
      mentions.push(...collaboratorMentions)
    }

    return mentions
  }, [isCollaborativeChat, collaboratorMentions])

  // Filter mentions based on query
  const filteredMentions = useMemo(() => {
    if (!query) {
      return allMentions
    }

    return allMentions.filter((mention) => {
      // Match by name (lowercased, no spaces)
      if (mention.name.includes(query)) {
        return true
      }
      // Match by display name
      if (mention.displayName.toLowerCase().includes(query)) {
        return true
      }
      return false
    })
  }, [query, allMentions])

  // Reset selected index when filtered mentions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredMentions.length])

  // Select a mention and trigger the callback
  const selectMention = useCallback(
    (mention: MentionTarget) => {
      onSelectMention(mention)
    },
    [onSelectMention]
  )

  // Close the menu
  const close = useCallback(() => {
    // Handled by parent
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || filteredMentions.length === 0) {
        return false
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredMentions.length - 1 ? prev + 1 : 0
          )
          return true

        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredMentions.length - 1
          )
          return true

        case "Tab":
        case "Enter":
          if (filteredMentions[selectedIndex]) {
            e.preventDefault()
            selectMention(filteredMentions[selectedIndex])
            return true
          }
          return false

        case "Escape":
          e.preventDefault()
          return true

        default:
          return false
      }
    },
    [isOpen, filteredMentions, selectedIndex, selectMention]
  )

  return {
    isOpen,
    query,
    selectedIndex,
    filteredMentions,
    mentionStartPosition,
    handleKeyDown,
    selectMention,
    setSelectedIndex,
    close,
  }
}

/**
 * Parse mentions from message content.
 * Returns an array of mentioned user IDs or special mentions.
 */
export function parseMentions(content: string): {
  hasMentions: boolean
  mentionsAI: boolean
  mentionsEveryone: boolean
  mentionedUserIds: string[]
} {
  const mentionRegex = /@(\w+)/g
  const matches = [...content.matchAll(mentionRegex)]

  const mentionsAI = matches.some(m =>
    m[1].toLowerCase() === "romy" ||
    m[1].toLowerCase() === "ai"
  )

  const mentionsEveryone = matches.some(m =>
    m[1].toLowerCase() === "everyone"
  )

  // Note: In a full implementation, we'd map display names to user IDs
  // For now, we just return the raw mentioned names
  const mentionedUserIds: string[] = []

  return {
    hasMentions: matches.length > 0,
    mentionsAI,
    mentionsEveryone,
    mentionedUserIds,
  }
}
