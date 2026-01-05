"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ClockIcon } from "@/components/ui/clock"
import {
  formatTimeEstimate,
  calculateInitialEstimate,
} from "@/lib/chat/time-estimation"

interface LoaderOverlayProps {
  isActive: boolean
  enableSearch: boolean
  startTime: number | null
  isExecutingTools?: boolean
}

export function LoaderOverlay({
  isActive,
  enableSearch,
  startTime,
  isExecutingTools = false,
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

  return (
    <AnimatePresence>
      {isActive && (
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
            <ClockIcon size={14} className="text-muted-foreground" animate />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {isExecutingTools
                ? "Using tools..."
                : isOverEstimate
                  ? "Almost done..."
                  : `Est. ${formatTimeEstimate(remainingSeconds)} remaining`}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
