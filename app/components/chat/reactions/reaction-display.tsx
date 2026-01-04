"use client"

/**
 * ReactionDisplay
 * Displays existing reactions on a message as small emoji pills
 * Shows count and allows toggling (clicking adds/removes your reaction)
 */

import { cn } from "@/lib/utils"
import { type ReactionGroup } from "@/lib/reactions"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ReactionDisplayProps {
  reactions: ReactionGroup[]
  onToggle: (emoji: string) => void
  className?: string
}

export function ReactionDisplay({ reactions, onToggle, className }: ReactionDisplayProps) {
  if (!reactions.length) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {reactions.map((reaction) => (
        <Tooltip key={reaction.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onToggle(reaction.emoji)}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors",
                "hover:bg-accent/80",
                reaction.hasReacted
                  ? "bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400"
                  : "bg-muted border border-transparent text-muted-foreground"
              )}
            >
              <span>{reaction.emoji}</span>
              <span className="font-medium">{reaction.count}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs">
              {reaction.users.slice(0, 5).map((u, i) => (
                <span key={u.user_id}>
                  {i > 0 && ", "}
                  {u.display_name || "Someone"}
                </span>
              ))}
              {reaction.users.length > 5 && (
                <span> and {reaction.users.length - 5} more</span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
