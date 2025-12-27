"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Spinner,
  Tray,
} from "@phosphor-icons/react"
import { DraftList } from "./draft-list"
import { DraftEditor } from "./draft-editor"
import type { GmailDraftRecord, DraftFormData } from "./types"

interface DraftsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DraftsModal({ open, onOpenChange }: DraftsModalProps) {
  const queryClient = useQueryClient()
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedDraftId(null)
      setIsEditing(false)
    }
  }, [open])

  // Fetch drafts with auto-refresh
  const {
    data: draftsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["gmail-drafts"],
    queryFn: async () => {
      const res = await fetchClient("/api/google-integrations/gmail/drafts")
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch drafts")
      }
      return res.json() as Promise<{
        success: boolean
        drafts: GmailDraftRecord[]
        count: number
      }>
    },
    enabled: open,
    refetchOnWindowFocus: true,
    refetchInterval: open ? 5000 : false, // Auto-refresh every 5 seconds when modal is open
    staleTime: 2000, // Consider data stale after 2 seconds
  })

  const drafts = draftsData?.drafts || []
  const pendingCount = drafts.filter((d) => d.status === "pending").length

  // Discard mutation
  const discardMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetchClient(
        `/api/google-integrations/gmail/drafts/${draftId}`,
        {
          method: "DELETE",
        }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to discard draft")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Draft discarded",
        description: "The draft has been deleted from Gmail.",
      })
      queryClient.invalidateQueries({ queryKey: ["gmail-drafts"] })
    },
    onError: (error) => {
      toast({
        title: "Failed to discard",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      draftId,
      data,
    }: {
      draftId: string
      data: DraftFormData
    }) => {
      const res = await fetchClient(
        `/api/google-integrations/gmail/drafts/${draftId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      )
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update draft")
      }
      return res.json()
    },
    onSuccess: async () => {
      toast({
        title: "Draft updated",
        description: "Your changes have been saved to Gmail.",
      })
      // Refetch to get the updated data before showing the list
      await refetch()
      setIsEditing(false)
      setSelectedDraftId(null)
    },
    onError: (error) => {
      toast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleEdit = useCallback((draftId: string) => {
    setSelectedDraftId(draftId)
    setIsEditing(true)
  }, [])

  const handleDiscard = useCallback(
    (draftId: string) => {
      discardMutation.mutate(draftId)
    },
    [discardMutation]
  )

  const handleSave = useCallback(
    async (draftId: string, data: DraftFormData) => {
      await updateMutation.mutateAsync({ draftId, data })
    },
    [updateMutation]
  )

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setSelectedDraftId(null)
  }, [])

  const selectedDraft = drafts.find((d) => d.id === selectedDraftId)

  // Loading state
  if (isLoading && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="flex items-center justify-center py-12 bg-white dark:bg-[#1a1a1a]">
            <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[80vh] flex flex-col">
        <div className="p-4 bg-white dark:bg-[#1a1a1a] flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-black dark:text-white flex items-center gap-2">
              <Image
                src="/svgs/Gmail SVG Icon.svg"
                alt="Gmail"
                width={20}
                height={20}
                className="size-5"
              />
              Gmail Drafts
            </h2>
          </div>

          {/* Stats bar */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Pending
            </span>
            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
              {pendingCount} draft{pendingCount !== 1 ? "s" : ""}
            </span>
          </div>

          <hr className="border-gray-200 dark:border-[#333] my-2" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isEditing && selectedDraft ? (
              <DraftEditor
                draft={selectedDraft}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                isSaving={updateMutation.isPending}
              />
            ) : drafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Tray size={48} className="text-gray-400 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-black dark:text-white mb-1">
                  No drafts yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
                  When you ask AI to write emails, drafts will appear here.
                  Review, edit, and send them from Gmail.
                </p>
              </div>
            ) : (
              <DraftList
                drafts={drafts}
                onEdit={handleEdit}
                onDiscard={handleDiscard}
                discardingId={
                  discardMutation.isPending
                    ? (discardMutation.variables as string)
                    : null
                }
              />
            )}
          </div>

          {/* Footer */}
          {!isEditing && drafts.length > 0 && (
            <>
              <hr className="border-gray-200 dark:border-[#333] my-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                AI-generated drafts match your writing style
              </p>
            </>
          )}

          {/* Close button */}
          {!isEditing && (
            <button
              type="button"
              className="w-full h-10 rounded bg-black dark:bg-white hover:bg-transparent border border-black dark:border-white text-white dark:text-black hover:text-black dark:hover:text-white font-semibold text-sm transition-all mt-3"
              onClick={() => onOpenChange(false)}
            >
              Done
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
