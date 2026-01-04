"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowDown } from "@phosphor-icons/react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { useEffect, useState, useCallback, useRef } from "react"

export type NewMessagesIndicatorProps = {
  className?: string
  messageCount: number
  onScrollToBottom?: () => void
}

/**
 * NewMessagesIndicator
 * Shows a badge when user has scrolled up and new messages have arrived.
 * Clicking scrolls to the bottom and clears the indicator.
 */
function NewMessagesIndicator({
  className,
  messageCount,
  onScrollToBottom,
}: NewMessagesIndicatorProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const [newMessageCount, setNewMessageCount] = useState(0)
  const lastSeenCountRef = useRef(messageCount)
  const wasAtBottomRef = useRef(true)

  // Track when user scrolls away from bottom
  useEffect(() => {
    if (isAtBottom) {
      // User is at bottom - clear the counter and update last seen
      setNewMessageCount(0)
      lastSeenCountRef.current = messageCount
      wasAtBottomRef.current = true
    } else if (wasAtBottomRef.current) {
      // User just scrolled away from bottom
      wasAtBottomRef.current = false
      lastSeenCountRef.current = messageCount
    }
  }, [isAtBottom, messageCount])

  // Track new messages arriving when user is scrolled up
  useEffect(() => {
    if (!isAtBottom && messageCount > lastSeenCountRef.current) {
      const newCount = messageCount - lastSeenCountRef.current
      setNewMessageCount(newCount)
    }
  }, [messageCount, isAtBottom])

  const handleClick = useCallback(() => {
    scrollToBottom()
    setNewMessageCount(0)
    lastSeenCountRef.current = messageCount
    onScrollToBottom?.()
  }, [scrollToBottom, messageCount, onScrollToBottom])

  // Don't show if at bottom or no new messages
  if (isAtBottom || newMessageCount === 0) {
    return null
  }

  return (
    <Button
      variant="default"
      size="sm"
      className={cn(
        "gap-2 rounded-full shadow-lg transition-all duration-200 animate-in slide-in-from-bottom-2",
        className
      )}
      onClick={handleClick}
    >
      <ArrowDown className="h-4 w-4" weight="bold" />
      <span>
        {newMessageCount === 1
          ? "1 new message"
          : `${newMessageCount} new messages`}
      </span>
    </Button>
  )
}

export { NewMessagesIndicator }
