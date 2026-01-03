"use client"

import { usePresenceOptional } from "@/lib/presence"
import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  className?: string
}

/**
 * Displays "X is typing..." indicator for collaborative chats
 */
export function TypingIndicator({ className }: TypingIndicatorProps) {
  const presence = usePresenceOptional()

  if (!presence || presence.typingUsers.length === 0) {
    return null
  }

  const { typingUsers } = presence

  // Format the typing message
  const typingMessage = formatTypingMessage(
    typingUsers.map((u) => u.display_name)
  )

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      <TypingDots />
      <span>{typingMessage}</span>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-0.5">
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}

function formatTypingMessage(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return `${names[0]} is typing...`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`
  return `${names[0]} and ${names.length - 1} others are typing...`
}
