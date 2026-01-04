"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { MentionTarget } from "./use-mention-menu"

interface MentionMenuProps {
  isOpen: boolean
  mentions: MentionTarget[]
  selectedIndex: number
  onSelect: (mention: MentionTarget) => void
  onHover: (index: number) => void
}

/**
 * Floating menu that appears above the chat input when typing @mentions.
 * Shows available mention targets (AI, collaborators) with keyboard navigation.
 */
export function MentionMenu({
  isOpen,
  mentions,
  selectedIndex,
  onSelect,
  onHover,
}: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && menuRef.current) {
      selectedRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [selectedIndex])

  if (!isOpen) {
    return null
  }

  const hasNoResults = mentions.length === 0

  return (
    <div
      ref={menuRef}
      className="animate-in fade-in-0 slide-in-from-bottom-2 absolute bottom-full left-0 right-0 z-50 mb-2 px-2 duration-150"
      role="listbox"
      aria-label="Mention suggestions"
    >
      <div className="bg-popover text-popover-foreground border-border overflow-hidden rounded-md border p-1 shadow-md backdrop-blur-xl">
        {hasNoResults ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">
            No matching users
          </div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto">
            {mentions.map((mention, index) => {
              const isSelected = index === selectedIndex
              const Icon = mention.icon

              return (
                <button
                  key={mention.id}
                  ref={isSelected ? selectedRef : null}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden transition-colors select-none",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => onSelect(mention)}
                  onMouseEnter={() => onHover(index)}
                >
                  {/* Avatar or icon */}
                  {mention.profileImage ? (
                    <img
                      src={mention.profileImage}
                      alt={mention.displayName}
                      className="size-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      mention.type === "ai" ? "bg-blue-500/10 text-blue-500" :
                      mention.type === "everyone" ? "bg-purple-500/10 text-purple-500" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mention.displayName}</span>
                      {mention.type === "ai" && (
                        <span className="text-muted-foreground rounded bg-blue-500/10 px-1 py-0.5 text-xs text-blue-500">
                          AI
                        </span>
                      )}
                      {mention.type === "everyone" && (
                        <span className="text-muted-foreground rounded bg-purple-500/10 px-1 py-0.5 text-xs text-purple-500">
                          All
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      @{mention.name}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        {/* Footer hint */}
        <div className="border-border text-muted-foreground flex items-center justify-between border-t px-2 py-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Tab</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
