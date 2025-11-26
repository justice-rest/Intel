"use client"

import { useChats } from "@/lib/chat-store/chats/provider"
import { useSplitView } from "@/lib/split-view-store/provider"
import { cn } from "@/lib/utils"
import { ArrowsLeftRight, X } from "@phosphor-icons/react"

interface SplitPanelHeaderProps {
  chatId: string
  side: "left" | "right"
}

export function SplitPanelHeader({ chatId, side }: SplitPanelHeaderProps) {
  const { getChatById } = useChats()
  const { closePanel, swapPanels } = useSplitView()
  const chat = getChatById(chatId)

  return (
    <div className="bg-background/80 border-border/40 flex h-10 flex-shrink-0 items-center justify-between border-b px-3 backdrop-blur-sm">
      <span className="text-foreground truncate text-sm font-medium">
        {chat?.title || "New Chat"}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={swapPanels}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          )}
          title="Swap panels"
          aria-label="Swap panels"
        >
          <ArrowsLeftRight size={14} weight="bold" />
        </button>
        <button
          onClick={() => closePanel(side)}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          )}
          title="Close panel"
          aria-label="Close panel"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
