"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ClockIcon } from "@/components/ui/clock"
import {
  formatTimeEstimate,
  calculateInitialEstimate,
} from "@/lib/chat/time-estimation"
import type { TypingUser } from "@/lib/presence/types"

interface LoaderOverlayProps {
  isActive: boolean
  enableSearch: boolean
  startTime: number | null
  isExecutingTools?: boolean
  /** List of users currently typing (for collaboration) */
  typingUsers?: TypingUser[]
}

export function LoaderOverlay({
  isActive,
  enableSearch,
  startTime,
  isExecutingTools = false,
  typingUsers = [],
}: LoaderOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // Track our own start time if none provided
  const localStartTimeRef = useRef<number | null>(null)

  // Calculate initial estimate based on whether search is enabled
  const initialEstimate = useMemo(() => {
    return calculateInitialEstimate(enableSearch)
  }, [enableSearch])

  // Set local start time when becoming active
  useEffect(() => {
    if (isActive && !localStartTimeRef.current) {
      localStartTimeRef.current = Date.now()
    } else if (!isActive) {
      localStartTimeRef.current = null
    }
  }, [isActive])

  // Use provided startTime or fallback to local
  const effectiveStartTime = startTime || localStartTimeRef.current

  // Track elapsed time
  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0)
      return
    }

    const currentStart = effectiveStartTime || Date.now()

    // Set initial elapsed time
    setElapsedSeconds(Math.floor((Date.now() - currentStart) / 1000))

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - currentStart) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, effectiveStartTime])

  // Calculate remaining time (adaptive)
  const remainingSeconds = Math.max(0, initialEstimate - elapsedSeconds)

  // If we've exceeded the estimate, show "Almost done..."
  const isOverEstimate = elapsedSeconds > initialEstimate

  // Format typing message
  const typingMessage = useMemo(() => {
    if (typingUsers.length === 0) return ""
    const names = typingUsers.map((u) => u.display_name)
    if (names.length === 1) return `${names[0]} is typing`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`
    return `${names[0]} and ${names.length - 1} others are typing`
  }, [typingUsers])

  // Show bubble if AI is active OR someone is typing
  const shouldShow = isActive || typingUsers.length > 0

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-10"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border border-border/50 rounded-full shadow-lg">
            {/* Show typing indicator if someone is typing */}
            {typingUsers.length > 0 && !isActive && (
              <>
                <TypingDots />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {typingMessage}
                </span>
              </>
            )}
            {/* Show AI status if processing */}
            {isActive && (
              <>
                <ClockIcon size={14} className="text-muted-foreground" animate />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {isExecutingTools
                    ? "Using tools..."
                    : isOverEstimate
                      ? "Almost done..."
                      : `Est. ${formatTimeEstimate(remainingSeconds)} remaining`}
                </span>
              </>
            )}
            {/* Show both if AI is processing AND someone is typing */}
            {isActive && typingUsers.length > 0 && (
              <>
                <span className="text-muted-foreground/50 mx-1">·</span>
                <TypingDots />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {typingMessage}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Animated typing dots */
function TypingDots() {
  return (
    <div className="flex items-center gap-0.5">
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "0ms", animationDuration: "600ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </div>
  )
}
