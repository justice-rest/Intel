"use client"

import { Chat } from "@/app/components/chat/chat"
import { StandaloneChatSessionProvider } from "@/lib/chat-store/session/standalone-provider"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { useSplitView } from "@/lib/split-view-store/provider"
import { DropZone } from "./drop-zone"
import { SplitPanelHeader } from "./split-panel-header"
import { cn } from "@/lib/utils"

interface SplitPanelProps {
  chatId: string
  side: "left" | "right"
  style?: React.CSSProperties
}

export function SplitPanel({ chatId, side, style }: SplitPanelProps) {
  const { replacePanel } = useSplitView()

  const handleDrop = (droppedChatId: string) => {
    replacePanel(side, droppedChatId)
  }

  return (
    <div
      className={cn(
        "bg-background relative flex h-full flex-col overflow-hidden",
        side === "left" ? "border-r border-border/40" : ""
      )}
      style={style}
    >
      <SplitPanelHeader chatId={chatId} side={side} />
      <StandaloneChatSessionProvider chatId={chatId}>
        <MessagesProvider chatIdOverride={chatId}>
          <div className="relative flex-1 overflow-hidden">
            <DropZone onDrop={handleDrop} currentChatId={chatId} />
            <Chat chatIdOverride={chatId} />
          </div>
        </MessagesProvider>
      </StandaloneChatSessionProvider>
    </div>
  )
}
