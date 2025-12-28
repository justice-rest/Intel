"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { SlashCommand } from "./use-slash-command-menu"

interface SlashCommandMenuProps {
  isOpen: boolean
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  onHover: (index: number) => void
  hasQuery: boolean // Whether user has typed beyond just "/"
}

/**
 * Floating menu that appears above the chat input when typing slash commands.
 * Shows available commands with keyboard navigation support.
 */
export function SlashCommandMenu({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onHover,
  hasQuery,
}: SlashCommandMenuProps) {
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

  const hasNoResults = commands.length === 0 && hasQuery

  return (
    <div
      ref={menuRef}
      className="animate-in fade-in-0 slide-in-from-bottom-2 absolute bottom-full left-0 right-0 z-50 mb-2 px-2 duration-150"
      role="listbox"
      aria-label="Slash commands"
    >
      <div className="bg-popover text-popover-foreground border-border overflow-hidden rounded-md border p-1 shadow-md backdrop-blur-xl">
        {hasNoResults ? (
          // No results state
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">
            No commands found
          </div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto">
            {commands.map((command, index) => {
              const isSelected = index === selectedIndex
              const Icon = command.icon

              return (
                <button
                  key={command.id}
                  ref={isSelected ? selectedRef : null}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden transition-colors select-none",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => onSelect(command)}
                  onMouseEnter={() => onHover(index)}
                >
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{command.label}</span>
                      <code className="text-muted-foreground rounded bg-muted/50 px-1 py-0.5 text-xs">
                        {command.command}
                      </code>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {command.description}
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
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">↵</kbd>
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
