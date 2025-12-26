"use client"

import { Loader2, InboxIcon } from "lucide-react"
import { DraftCard } from "./draft-card"
import type { GmailDraftRecord, DraftFormData } from "./types"

interface DraftListProps {
  drafts: GmailDraftRecord[]
  isLoading?: boolean
  onEdit: (draftId: string) => void
  onDiscard: (draftId: string) => void
  discardingId?: string | null
}

export function DraftList({
  drafts,
  isLoading,
  onEdit,
  onDiscard,
  discardingId,
}: DraftListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <InboxIcon className="size-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-1">No drafts yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          When you ask AI to write emails, drafts will appear here.
          You can review, edit, and send them from Gmail.
        </p>
      </div>
    )
  }

  // Sort by status (pending first) and then by date (newest first)
  const sortedDrafts = [...drafts].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1
    if (a.status !== "pending" && b.status === "pending") return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const pendingCount = drafts.filter((d) => d.status === "pending").length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} pending draft${pendingCount === 1 ? "" : "s"}`
            : "No pending drafts"}
        </span>
        <span className="text-muted-foreground">
          {drafts.length} total
        </span>
      </div>

      {/* Draft List */}
      <div className="space-y-3">
        {sortedDrafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            onEdit={onEdit}
            onDiscard={onDiscard}
            isDiscarding={discardingId === draft.id}
          />
        ))}
      </div>
    </div>
  )
}
