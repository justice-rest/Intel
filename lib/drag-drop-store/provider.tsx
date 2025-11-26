"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react"

interface DragDropState {
  isDragging: boolean
  draggedChatId: string | null
  draggedChatTitle: string | null
}

interface DragDropContextType extends DragDropState {
  startDrag: (chatId: string, title: string) => void
  endDrag: () => void
}

const DragDropContext = createContext<DragDropContextType | null>(null)

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (!context) {
    throw new Error("useDragDrop must be used within DragDropProvider")
  }
  return context
}

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    draggedChatId: null,
    draggedChatTitle: null,
  })

  const startDrag = useCallback((chatId: string, title: string) => {
    setState({
      isDragging: true,
      draggedChatId: chatId,
      draggedChatTitle: title,
    })
  }, [])

  const endDrag = useCallback(() => {
    setState({
      isDragging: false,
      draggedChatId: null,
      draggedChatTitle: null,
    })
  }, [])

  // Global dragend listener to ensure drag state is always cleared
  // This handles cases where drop happens outside valid zones or browser window
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setState({
        isDragging: false,
        draggedChatId: null,
        draggedChatTitle: null,
      })
    }

    // Listen for dragend on the document to catch all drag end events
    document.addEventListener("dragend", handleGlobalDragEnd)
    // Also listen for drop in case dragend doesn't fire
    document.addEventListener("drop", handleGlobalDragEnd)

    return () => {
      document.removeEventListener("dragend", handleGlobalDragEnd)
      document.removeEventListener("drop", handleGlobalDragEnd)
    }
  }, [])

  const value = useMemo<DragDropContextType>(
    () => ({
      ...state,
      startDrag,
      endDrag,
    }),
    [state, startDrag, endDrag]
  )

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  )
}
