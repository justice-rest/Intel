"use client"

/**
 * Read Receipt Indicator
 * Shows who has read a message in collaborative chats
 *
 * Displays:
 * - Double checkmarks for read status
 * - Stacked avatars of readers
 * - "Seen by X" tooltip with full list
 */

import { useMemo } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Check, Checks } from "@phosphor-icons/react"
import type { ReadReceipt, ChatReadStatus } from "@/lib/collaboration/read-receipts"

interface ReadReceiptIndicatorProps {
  /** The message ID to check read status for */
  messageId: number
  /** All read statuses for the chat */
  readStatuses: ChatReadStatus[]
  /** Current user ID (to exclude from display) */
  currentUserId?: string
  /** Optional user data map for display names/avatars */
  collaborators?: Array<{
    user_id: string
    user?: {
      display_name: string | null
      profile_image: string | null
    }
  }>
  /** Size variant */
  size?: "sm" | "md"
  /** Additional class name */
  className?: string
  /** Show just checkmarks (no avatars) */
  minimal?: boolean
}

/**
 * Displays read receipt status for a message
 */
export function ReadReceiptIndicator({
  messageId,
  readStatuses,
  currentUserId,
  collaborators = [],
  size = "sm",
  className,
  minimal = false,
}: ReadReceiptIndicatorProps) {
  // Calculate who has read this message
  const readers = useMemo(() => {
    return readStatuses
      .filter(
        (s) =>
          s.last_read_message_id >= messageId &&
          s.user_id !== currentUserId
      )
      .map((s) => {
        // Try to get user data from collaborators
        const collab = collaborators.find((c) => c.user_id === s.user_id)
        return {
          user_id: s.user_id,
          display_name: collab?.user?.display_name || "Unknown",
          profile_image: collab?.user?.profile_image || null,
          read_at: s.read_at,
        }
      })
      .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime())
  }, [messageId, readStatuses, currentUserId, collaborators])

  // No readers = single check (sent), readers = double check (read)
  const hasBeenRead = readers.length > 0

  // Minimal mode: just show checkmarks
  if (minimal) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center text-muted-foreground",
                hasBeenRead && "text-blue-500",
                className
              )}
            >
              {hasBeenRead ? (
                <Checks
                  className={cn(
                    size === "sm" ? "size-3.5" : "size-4"
                  )}
                  weight="bold"
                />
              ) : (
                <Check
                  className={cn(
                    size === "sm" ? "size-3.5" : "size-4"
                  )}
                  weight="bold"
                />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            {hasBeenRead ? (
              <div className="text-xs">
                <div className="font-medium mb-1">
                  Seen by {readers.length} {readers.length === 1 ? "person" : "people"}
                </div>
                <div className="space-y-0.5 text-muted-foreground">
                  {readers.slice(0, 5).map((reader) => (
                    <div key={reader.user_id} className="truncate">
                      {reader.display_name}
                    </div>
                  ))}
                  {readers.length > 5 && (
                    <div className="text-muted-foreground">
                      +{readers.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-xs">Sent</span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full mode with avatars
  if (!hasBeenRead) {
    return null // Don't show anything if not read by others
  }

  const maxVisible = 3
  const visibleReaders = readers.slice(0, maxVisible)
  const extraCount = readers.length - maxVisible

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5", className)}>
            <Checks
              className={cn(
                "text-blue-500",
                size === "sm" ? "size-3.5" : "size-4"
              )}
              weight="bold"
            />
            <div className="flex items-center -space-x-1.5">
              {visibleReaders.map((reader, index) => (
                <ReaderAvatar
                  key={reader.user_id}
                  reader={reader}
                  size={size}
                  style={{ zIndex: maxVisible - index }}
                />
              ))}
              {extraCount > 0 && (
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full bg-muted border border-background font-medium",
                    size === "sm" ? "size-4 text-[8px]" : "size-5 text-[9px]"
                  )}
                  style={{ zIndex: 0 }}
                >
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="text-xs">
            <div className="font-medium mb-1">
              Seen by {readers.length} {readers.length === 1 ? "person" : "people"}
            </div>
            <div className="space-y-0.5 text-muted-foreground">
              {readers.slice(0, 10).map((reader) => (
                <div key={reader.user_id} className="flex items-center gap-1.5">
                  <ReaderAvatar reader={reader} size="sm" />
                  <span className="truncate">{reader.display_name}</span>
                </div>
              ))}
              {readers.length > 10 && (
                <div className="text-muted-foreground mt-1">
                  +{readers.length - 10} more
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ReaderAvatarProps {
  reader: {
    user_id: string
    display_name: string
    profile_image: string | null
  }
  size?: "sm" | "md"
  style?: React.CSSProperties
}

function ReaderAvatar({ reader, size = "sm", style }: ReaderAvatarProps) {
  const initials = reader.display_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div
      className={cn(
        "rounded-full border border-background overflow-hidden bg-muted",
        size === "sm" ? "size-4" : "size-5"
      )}
      style={style}
    >
      {reader.profile_image ? (
        <img
          src={reader.profile_image}
          alt={reader.display_name}
          className="size-full object-cover"
        />
      ) : (
        <div
          className={cn(
            "size-full bg-primary flex items-center justify-center font-medium text-primary-foreground",
            size === "sm" ? "text-[6px]" : "text-[7px]"
          )}
        >
          {initials || "?"}
        </div>
      )}
    </div>
  )
}

/**
 * Simplified read receipt indicator for use in message actions area
 * Just shows double-checks with blue color when read
 */
export function ReadReceiptCheckmark({
  hasBeenRead,
  readerCount = 0,
  className,
}: {
  hasBeenRead: boolean
  readerCount?: number
  className?: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center",
              hasBeenRead ? "text-blue-500" : "text-muted-foreground",
              className
            )}
          >
            {hasBeenRead ? (
              <Checks className="size-3.5" weight="bold" />
            ) : (
              <Check className="size-3.5" weight="bold" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">
            {hasBeenRead
              ? `Seen by ${readerCount} ${readerCount === 1 ? "person" : "people"}`
              : "Sent"}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
