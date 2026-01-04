"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ClockIcon } from "@/components/ui/clock"
import {
  formatTimeEstimate,
  calculateInitialEstimate,
} from "@/lib/chat/time-estimation"
import type { TypingUser, AIStatus } from "@/lib/presence/types"
import { Brain, Lightning } from "@phosphor-icons/react"

interface LoaderOverlayProps {
  isActive: boolean
  enableSearch: boolean
  startTime: number | null
  isExecutingTools?: boolean
  /** List of users currently typing (for collaboration) */
  typingUsers?: TypingUser[]
  /** AI status from another collaborator */
  collaboratorAIStatus?: AIStatus | null
}

export function LoaderOverlay({
  isActive,
  enableSearch,
  startTime,
  isExecutingTools = false,
  typingUsers = [],
  collaboratorAIStatus = null,
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

  // Format collaborator AI status message
  const collaboratorAIMessage = useMemo(() => {
    if (!collaboratorAIStatus) return ""
    const name = collaboratorAIStatus.display_name
    switch (collaboratorAIStatus.status) {
      case "thinking":
        return `${name}'s AI is thinking`
      case "streaming":
        return `${name}'s AI is responding`
      case "using_tools":
        const toolName = collaboratorAIStatus.tool_name
        return toolName
          ? `${name}'s AI is using ${toolName}`
          : `${name}'s AI is using tools`
      default:
        return ""
    }
  }, [collaboratorAIStatus])

  // Check if a collaborator's AI is active
  const hasCollaboratorAI = collaboratorAIStatus && collaboratorAIStatus.status !== "idle"

  // Show bubble if AI is active OR someone is typing OR collaborator's AI is active
  const shouldShow = isActive || typingUsers.length > 0 || hasCollaboratorAI

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
            {/* Show collaborator's AI status first (most important for group awareness) */}
            {hasCollaboratorAI && !isActive && (
              <>
                {collaboratorAIStatus?.status === "using_tools" ? (
                  <Lightning size={14} className="text-amber-500 animate-pulse" weight="fill" />
                ) : (
                  <Brain size={14} className="text-primary animate-pulse" weight="fill" />
                )}
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {collaboratorAIMessage}
                </span>
              </>
            )}
            {/* Show typing indicator if someone is typing (and no AI active) */}
            {typingUsers.length > 0 && !isActive && !hasCollaboratorAI && (
              <>
                <TypingDots />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {typingMessage}
                </span>
              </>
            )}
            {/* Show our AI status if processing */}
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
            {/* Show additional info: collaborator AI + our AI */}
            {isActive && hasCollaboratorAI && (
              <>
                <span className="text-muted-foreground/50 mx-1">·</span>
                <Brain size={14} className="text-primary/70 animate-pulse" weight="fill" />
                <span className="text-sm text-muted-foreground/70 whitespace-nowrap">
                  {collaboratorAIMessage}
                </span>
              </>
            )}
            {/* Show typing users alongside AI activity */}
            {(isActive || hasCollaboratorAI) && typingUsers.length > 0 && (
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
