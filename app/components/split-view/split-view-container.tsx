"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useSplitView } from "@/lib/split-view-store/provider"
import { cn } from "@/lib/utils"
import { useRef } from "react"
import { ResizeHandle } from "./resize-handle"
import { SplitPanel } from "./split-panel"

export function SplitViewContainer() {
  const { isActive, leftChatId, rightChatId, splitRatio, setSplitRatio } =
    useSplitView()
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useBreakpoint(768)

  // Don't render until we have valid chat IDs
  if (!isActive || !leftChatId || !rightChatId) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full",
        isMobile ? "flex-col" : "flex-row"
      )}
    >
      <SplitPanel
        chatId={leftChatId}
        side="left"
        style={{
          [isMobile ? "height" : "width"]: `${splitRatio * 100}%`,
          [isMobile ? "width" : "height"]: "100%",
        }}
      />
      <ResizeHandle
        onResize={setSplitRatio}
        containerRef={containerRef}
        orientation={isMobile ? "horizontal" : "vertical"}
      />
      <SplitPanel
        chatId={rightChatId}
        side="right"
        style={{
          [isMobile ? "height" : "width"]: `${(1 - splitRatio) * 100}%`,
          [isMobile ? "width" : "height"]: "100%",
        }}
      />
    </div>
  )
}
