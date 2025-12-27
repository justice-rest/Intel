"use client"

import { cn } from "@/lib/utils"
import {
  PencilSimple,
  Trash,
  ArrowSquareOut,
  Robot,
  Spinner,
} from "@phosphor-icons/react"
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
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      sent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      discarded: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      edited: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    }

    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-xs font-medium capitalize",
          statusStyles[draft.status]
        )}
      >
        {draft.status}
      </span>
    )
  }

  const openInGmail = () => {
    window.open(
      `https://mail.google.com/mail/u/0/#drafts/${draft.draft_id}`,
      "_blank"
    )
  }

  return (
    <div className="p-3 border border-gray-200 dark:border-[#333] rounded bg-gray-50 dark:bg-[#222]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              To: {draft.to_recipients.join(", ")}
            </span>
          </div>
          <h4 className="text-sm font-medium text-black dark:text-white truncate">
            {draft.subject || "(No subject)"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {getStatusBadge()}
          {draft.created_by_ai && (
            <span title="AI-generated" className="text-gray-400">
              <Robot size={14} weight="fill" />
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
        {draft.body_preview || "No preview available"}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-[#333]">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(draft.created_at)}
        </span>
        <div className="flex gap-1">
          {draft.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => onEdit(draft.id)}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#333] transition-colors text-gray-600 dark:text-gray-400"
                title="Edit"
              >
                <PencilSimple size={14} />
              </button>
              <button
                type="button"
                onClick={openInGmail}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#333] transition-colors text-gray-600 dark:text-gray-400"
                title="Open in Gmail"
              >
                <ArrowSquareOut size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDiscard(draft.draft_id)}
                disabled={isDiscarding}
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500 dark:text-red-400 disabled:opacity-50"
                title="Discard"
              >
                {isDiscarding ? (
                  <Spinner size={14} className="animate-spin" />
                ) : (
                  <Trash size={14} />
                )}
              </button>
            </>
          )}
          {draft.status !== "pending" && (
            <button
              type="button"
              onClick={openInGmail}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#333] transition-colors text-gray-600 dark:text-gray-400"
              title="View in Gmail"
            >
              <ArrowSquareOut size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
