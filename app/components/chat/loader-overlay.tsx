"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { BookLoader } from "@/components/prompt-kit/book-loader"
import {
  formatTimeEstimate,
  calculateInitialEstimate,
} from "@/lib/chat/time-estimation"

interface LoaderOverlayProps {
  isActive: boolean
  enableSearch: boolean
  startTime: number | null
}

export function LoaderOverlay({
  isActive,
  enableSearch,
  startTime,
}: LoaderOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Calculate initial estimate based on whether search is enabled
  const initialEstimate = useMemo(() => {
    return calculateInitialEstimate(enableSearch)
  }, [enableSearch])

  // Track elapsed time
  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsedSeconds(0)
      return
    }

    // Set initial elapsed time
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, startTime])

  // Calculate remaining time (adaptive)
  const remainingSeconds = Math.max(0, initialEstimate - elapsedSeconds)

  // If we've exceeded the estimate, show "Almost done..."
  const isOverEstimate = elapsedSeconds > initialEstimate

  return (
    <AnimatePresence>
      {isActive && startTime && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{
            duration: 0.25,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-10"
        >
          <div className="flex items-center gap-3 px-4 py-2.5 bg-background/95 backdrop-blur-sm border border-border/50 rounded-full shadow-lg">
            <div className="flex items-center justify-center w-6 h-6">
              <BookLoader />
            </div>
            <motion.span
              key={isOverEstimate ? "almost" : remainingSeconds}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              {isOverEstimate
                ? "Almost done..."
                : `Est. ${formatTimeEstimate(remainingSeconds)} remaining`}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
