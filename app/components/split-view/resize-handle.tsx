"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

interface ResizeHandleProps {
  onResize: (ratio: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  orientation?: "vertical" | "horizontal"
}

export function ResizeHandle({
  onResize,
  containerRef,
  orientation = "vertical",
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const handleRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (clientX: number, clientY: number) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()

      let ratio: number
      if (orientation === "vertical") {
        ratio = (clientX - containerRect.left) / containerRect.width
      } else {
        ratio = (clientY - containerRect.top) / containerRect.height
      }

      onResize(Math.max(0.25, Math.min(0.75, ratio)))
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleEnd = () => setIsDragging(false)

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleEnd)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleEnd)

    // Prevent text selection while dragging
    document.body.style.userSelect = "none"
    document.body.style.cursor =
      orientation === "vertical" ? "col-resize" : "row-resize"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleEnd)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleEnd)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
  }, [isDragging, onResize, containerRef, orientation])

  const isVertical = orientation === "vertical"

  return (
    <div
      ref={handleRef}
      className={cn(
        "bg-border flex-shrink-0 transition-all duration-100",
        isVertical
          ? "w-px cursor-col-resize hover:w-1 hover:bg-primary/30"
          : "h-px cursor-row-resize hover:h-1 hover:bg-primary/30",
        isDragging && (isVertical ? "w-1 bg-primary/50" : "h-1 bg-primary/50")
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Larger touch target for easier grabbing */}
      <div
        className={cn(
          "absolute",
          isVertical
            ? "-left-1.5 top-0 h-full w-4 cursor-col-resize"
            : "-top-1.5 left-0 h-4 w-full cursor-row-resize"
        )}
      />
    </div>
  )
}
