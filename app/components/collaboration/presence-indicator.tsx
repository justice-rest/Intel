"use client"

import { usePresenceOptional } from "@/lib/presence"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { PresenceUser } from "@/lib/presence/types"

interface PresenceIndicatorProps {
  maxVisible?: number
  className?: string
}

/**
 * Displays stacked avatars of online users in a chat
 */
export function PresenceIndicator({
  maxVisible = 3,
  className,
}: PresenceIndicatorProps) {
  const presence = usePresenceOptional()

  if (!presence || presence.onlineUsers.length === 0) {
    return null
  }

  const { onlineUsers } = presence
  const visibleUsers = onlineUsers.slice(0, maxVisible)
  const extraCount = onlineUsers.length - maxVisible

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center -space-x-2", className)}>
            {visibleUsers.map((user, index) => (
              <UserAvatar
                key={user.user_id}
                user={user}
                style={{ zIndex: maxVisible - index }}
              />
            ))}
            {extraCount > 0 && (
              <div
                className="flex items-center justify-center size-7 rounded-full bg-muted border-2 border-background text-xs font-medium"
                style={{ zIndex: 0 }}
              >
                +{extraCount}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <div className="text-sm">
            <div className="font-medium mb-1">
              {onlineUsers.length} online
            </div>
            <div className="space-y-0.5 text-muted-foreground">
              {onlineUsers.map((user) => (
                <div key={user.user_id} className="flex items-center gap-1.5">
                  <StatusDot status={user.status} />
                  <span className="truncate">{user.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function UserAvatar({
  user,
  style,
}: {
  user: PresenceUser
  style?: React.CSSProperties
}) {
  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div
      className="relative size-7 rounded-full border-2 border-background overflow-hidden"
      style={style}
    >
      {user.profile_image ? (
        <img
          src={user.profile_image}
          alt={user.display_name}
          className="size-full object-cover"
        />
      ) : (
        <div className="size-full bg-primary flex items-center justify-center text-[10px] font-medium text-primary-foreground">
          {initials}
        </div>
      )}
      {/* Status indicator */}
      <div
        className={cn(
          "absolute bottom-0 right-0 size-2 rounded-full border border-background",
          user.status === "active" && "bg-green-500",
          user.status === "idle" && "bg-yellow-500",
          user.status === "away" && "bg-gray-400"
        )}
      />
    </div>
  )
}

function StatusDot({ status }: { status: PresenceUser["status"] }) {
  return (
    <div
      className={cn(
        "size-2 rounded-full",
        status === "active" && "bg-green-500",
        status === "idle" && "bg-yellow-500",
        status === "away" && "bg-gray-400"
      )}
    />
  )
}
