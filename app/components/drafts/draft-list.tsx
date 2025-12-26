"use client"

import { DraftCard } from "./draft-card"
import type { GmailDraftRecord } from "./types"

interface DraftListProps {
  drafts: GmailDraftRecord[]
  onEdit: (draftId: string) => void
  onDiscard: (draftId: string) => void
  discardingId?: string | null
}

export function DraftList({
  drafts,
  onEdit,
  onDiscard,
  discardingId,
}: DraftListProps) {
  // Sort by status (pending first) and then by date (newest first)
  const sortedDrafts = [...drafts].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1
    if (a.status !== "pending" && b.status === "pending") return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="space-y-2">
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
  )
}
