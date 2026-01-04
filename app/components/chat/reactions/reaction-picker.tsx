"use client"

/**
 * ReactionPicker
 * Quick emoji picker for adding reactions to messages
 * Shows common reactions in a popover
 */

import { cn } from "@/lib/utils"
import { QUICK_REACTIONS } from "@/lib/reactions"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Smiley } from "@phosphor-icons/react"
import { useState } from "react"

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  className?: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}

export function ReactionPicker({
  onSelect,
  className,
  side = "top",
  align = "center",
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (emoji: string) => {
    onSelect(emoji)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition",
            className
          )}
          aria-label="Add reaction"
        >
          <Smiley className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-auto p-1.5"
        sideOffset={4}
      >
        <div className="flex items-center gap-0.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="hover:bg-accent p-1.5 rounded-md text-lg transition-transform hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
