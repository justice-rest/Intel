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
import { RefreshCw, Mail } from "lucide-react"
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

  // Fetch drafts
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
  })

  const drafts = draftsData?.drafts || []

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
    onSuccess: () => {
      toast({
        title: "Draft updated",
        description: "Your changes have been saved to Gmail.",
      })
      setIsEditing(false)
      setSelectedDraftId(null)
      queryClient.invalidateQueries({ queryKey: ["gmail-drafts"] })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Gmail Drafts
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          {isEditing && selectedDraft ? (
            <DraftEditor
              draft={selectedDraft}
              onSave={handleSave}
              onCancel={handleCancelEdit}
              isSaving={updateMutation.isPending}
            />
          ) : (
            <DraftList
              drafts={drafts}
              isLoading={isLoading}
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
          <div className="flex-shrink-0 border-t pt-3 mt-3">
            <p className="text-xs text-muted-foreground text-center">
              {drafts.filter((d) => d.status === "pending").length} pending
              drafts • AI-generated with your writing style
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
