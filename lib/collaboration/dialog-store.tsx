"use client"

/**
 * Collaboration Dialog Store
 * Manages open/close state for collaboration dialogs
 * Uses React Context to allow header button to trigger dialogs rendered inside CollaborationWrapper
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type DialogType = "share" | "collaborators" | null

interface CollaborationDialogContextValue {
  openDialog: DialogType
  setOpenDialog: (dialog: DialogType) => void
  closeDialog: () => void
}

const CollaborationDialogContext = createContext<CollaborationDialogContextValue | null>(null)

export function useCollaborationDialogStore() {
  const context = useContext(CollaborationDialogContext)
  if (!context) {
    throw new Error("useCollaborationDialogStore must be used within CollaborationDialogProvider")
  }
  return context
}

// Optional hook that returns safe defaults when outside provider
export function useCollaborationDialogStoreOptional(): CollaborationDialogContextValue {
  const context = useContext(CollaborationDialogContext)
  // Return a no-op version if context doesn't exist
  return context || {
    openDialog: null,
    setOpenDialog: () => {},
    closeDialog: () => {},
  }
}

export function CollaborationDialogProvider({ children }: { children: ReactNode }) {
  const [openDialog, setOpenDialogState] = useState<DialogType>(null)

  const setOpenDialog = useCallback((dialog: DialogType) => {
    setOpenDialogState(dialog)
  }, [])

  const closeDialog = useCallback(() => {
    setOpenDialogState(null)
  }, [])

  return (
    <CollaborationDialogContext.Provider value={{ openDialog, setOpenDialog, closeDialog }}>
      {children}
    </CollaborationDialogContext.Provider>
  )
}
