"use client"

import { useState, useEffect, useMemo } from "react"
import { Clock } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  formatTimeEstimate,
  calculateInitialEstimate,
} from "@/lib/chat/time-estimation"

interface ResponseTimeEstimateProps {
  isActive: boolean
  enableSearch: boolean
  startTime: number | null
}

export function ResponseTimeEstimate({
  isActive,
  enableSearch,
  startTime,
}: ResponseTimeEstimateProps) {
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

  if (!isActive || !startTime) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
        className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Clock className="h-3 w-3" />
        <span>
          {isOverEstimate
            ? "Almost done..."
            : `Est. ${formatTimeEstimate(remainingSeconds)} remaining`}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
