"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import { useKeyShortcut } from "@/app/hooks/use-key-shortcut"
import type { GmailDraftRecord } from "./types"

interface DraftsContextType {
  isOpen: boolean
  openDraftsModal: () => void
  closeDraftsModal: () => void
  toggleDraftsModal: () => void
  pendingDraftsCount: number
  drafts: GmailDraftRecord[]
  isLoading: boolean
  refetchDrafts: () => void
}

const DraftsContext = createContext<DraftsContextType | null>(null)

export function DraftsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  // Fetch drafts count for badge
  const {
    data: draftsData,
    isLoading,
    refetch: refetchDrafts,
  } = useQuery({
    queryKey: ["gmail-drafts-count"],
    queryFn: async () => {
      try {
        const res = await fetchClient("/api/google-integrations/gmail/drafts?limit=50")
        if (!res.ok) return { drafts: [], count: 0 }
        return res.json() as Promise<{
          success: boolean
          drafts: GmailDraftRecord[]
          count: number
        }>
      } catch {
        return { drafts: [], count: 0 }
      }
    },
    // Refetch every 2 minutes to keep count updated
    refetchInterval: 2 * 60 * 1000,
    // Don't refetch on window focus to avoid too many requests
    refetchOnWindowFocus: false,
    // Keep stale data while refetching
    staleTime: 60 * 1000,
  })

  const drafts = draftsData?.drafts || []
  const pendingDraftsCount = drafts.filter((d) => d.status === "pending").length

  const openDraftsModal = useCallback(() => setIsOpen(true), [])
  const closeDraftsModal = useCallback(() => setIsOpen(false), [])
  const toggleDraftsModal = useCallback(() => setIsOpen((prev) => !prev), [])

  // Keyboard shortcut: Cmd+Shift+D (or Ctrl+Shift+D on Windows)
  useKeyShortcut(
    (e) => (e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey) && e.shiftKey,
    toggleDraftsModal
  )

  return (
    <DraftsContext.Provider
      value={{
        isOpen,
        openDraftsModal,
        closeDraftsModal,
        toggleDraftsModal,
        pendingDraftsCount,
        drafts,
        isLoading,
        refetchDrafts,
      }}
    >
      {children}
    </DraftsContext.Provider>
  )
}

export function useDrafts() {
  const context = useContext(DraftsContext)
  if (!context) {
    throw new Error("useDrafts must be used within a DraftsProvider")
  }
  return context
}

/**
 * Hook to check if a message is a /draft command
 * Returns the command handler if detected
 */
export function useSlashCommand() {
  const { openDraftsModal } = useDrafts()

  const processSlashCommand = useCallback(
    (message: string): { isCommand: boolean; handled: boolean } => {
      const trimmed = message.trim().toLowerCase()

      // Check for /draft or /drafts command
      if (trimmed === "/draft" || trimmed === "/drafts") {
        openDraftsModal()
        return { isCommand: true, handled: true }
      }

      return { isCommand: false, handled: false }
    },
    [openDraftsModal]
  )

  return { processSlashCommand }
}
