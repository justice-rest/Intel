"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Pencil, Trash2, ExternalLink, Mail, Bot } from "lucide-react"
import type { GmailDraftRecord } from "./types"

interface DraftCardProps {
  draft: GmailDraftRecord
  onEdit: (draftId: string) => void
  onDiscard: (draftId: string) => void
  isDiscarding?: boolean
}

export function DraftCard({
  draft,
  onEdit,
  onDiscard,
  isDiscarding,
}: DraftCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getStatusBadge = () => {
    const statusStyles = {
      pending: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
      sent: "bg-green-500/20 text-green-600 dark:text-green-400",
      discarded: "bg-red-500/20 text-red-600 dark:text-red-400",
      edited: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    }

    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
          statusStyles[draft.status]
        )}
      >
        {draft.status}
      </span>
    )
  }

  const openInGmail = () => {
    // Open draft in Gmail
    window.open(
      `https://mail.google.com/mail/u/0/#drafts/${draft.draft_id}`,
      "_blank"
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              To: {draft.to_recipients.join(", ")}
            </span>
          </div>
          <h4 className="font-medium truncate">
            {draft.subject || "(No subject)"}
          </h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge()}
          {draft.created_by_ai && (
            <span title="AI-generated">
              <Bot className="size-4 text-muted-foreground" />
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {draft.body_preview || "No preview available"}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          {formatDate(draft.created_at)}
        </span>
        <div className="flex gap-2">
          {draft.status === "pending" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(draft.id)}
                className="h-8"
              >
                <Pencil className="size-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openInGmail}
                className="h-8"
              >
                <ExternalLink className="size-3.5 mr-1" />
                Open in Gmail
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDiscard(draft.id)}
                disabled={isDiscarding}
                className="h-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5 mr-1" />
                Discard
              </Button>
            </>
          )}
          {draft.status !== "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openInGmail}
              className="h-8"
            >
              <ExternalLink className="size-3.5 mr-1" />
              View in Gmail
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
