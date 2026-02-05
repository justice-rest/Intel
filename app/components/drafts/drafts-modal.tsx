"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Spinner,
  Tray,
  Envelope,
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
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden max-h-[80vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <Envelope size={20} weight="fill" className="text-muted-foreground" />
            Drafts
          </DialogTitle>
          <p className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            {pendingCount > 0
              ? `${pendingCount} pending draft${pendingCount !== 1 ? "s" : ""} ready to review`
              : "AI-generated email drafts will appear here"}
          </p>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-4">
          {isEditing && selectedDraft ? (
            <DraftEditor
              draft={selectedDraft}
              onSave={handleSave}
              onCancel={handleCancelEdit}
              isSaving={updateMutation.isPending}
            />
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Tray size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                No drafts yet
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
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
        {!isEditing && (
          <div className="px-5 py-4 border-t bg-muted/30">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full h-9"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
