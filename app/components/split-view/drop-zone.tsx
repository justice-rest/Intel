"use client"

import { useDragDrop } from "@/lib/drag-drop-store/provider"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"
import { useCallback, useState } from "react"

interface DropZoneProps {
  onDrop: (chatId: string) => void
  currentChatId: string | null
  className?: string
}

export function DropZone({ onDrop, currentChatId, className }: DropZoneProps) {
  const { isDragging, draggedChatId, draggedChatTitle } = useDragDrop()
  const [isOver, setIsOver] = useState(false)

  // Don't show if not dragging or dragging the same chat
  const shouldShow = isDragging && draggedChatId !== currentChatId

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set isOver to false if we're leaving the drop zone itself
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsOver(false)
      const chatId = e.dataTransfer.getData("application/x-chat-id")
      if (chatId && chatId !== currentChatId) {
        onDrop(chatId)
      }
    },
    [onDrop, currentChatId]
  )

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center",
            "border-2 border-dashed rounded-lg",
            isOver
              ? "border-primary bg-primary/10 backdrop-blur-sm"
              : "border-primary/30 bg-primary/5",
            "transition-colors duration-150",
            className
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="pointer-events-none text-center">
            <p
              className={cn(
                "text-lg font-medium transition-colors duration-150",
                isOver ? "text-primary" : "text-primary/70"
              )}
            >
              {isOver ? "Release to split view" : "Drop to open side-by-side"}
            </p>
            {draggedChatTitle && (
              <p className="text-muted-foreground mt-1 text-sm">
                {draggedChatTitle}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
