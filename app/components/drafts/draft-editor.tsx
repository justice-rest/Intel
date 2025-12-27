"use client"

import { useState, useEffect } from "react"
import {
  FloppyDisk,
  X,
  ArrowSquareOut,
  Spinner,
} from "@phosphor-icons/react"
import { fetchClient } from "@/lib/fetch"
import type { DraftFormData, GmailDraftRecord } from "./types"

interface DraftEditorProps {
  draft: GmailDraftRecord
  onSave: (draftId: string, data: DraftFormData) => Promise<void>
  onCancel: () => void
  isSaving?: boolean
}

export function DraftEditor({
  draft,
  onSave,
  onCancel,
  isSaving,
}: DraftEditorProps) {
  const [isLoadingBody, setIsLoadingBody] = useState(true)
  const [formData, setFormData] = useState<DraftFormData>({
    to: draft.to_recipients,
    cc: draft.cc_recipients || [],
    subject: draft.subject,
    body: "",
    threadId: draft.thread_id,
  })

  const [toInput, setToInput] = useState(draft.to_recipients.join(", "))
  const [ccInput, setCcInput] = useState((draft.cc_recipients || []).join(", "))

  // Fetch the full draft body from Gmail API
  useEffect(() => {
    async function fetchDraftBody() {
      try {
        setIsLoadingBody(true)
        const res = await fetchClient(
          `/api/google-integrations/gmail/drafts/${draft.draft_id}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.draft) {
            setFormData((prev) => ({
              ...prev,
              body: data.draft.body || "",
              subject: data.draft.subject || prev.subject,
            }))
            // Also update to/cc if they differ
            if (data.draft.to?.length > 0) {
              setToInput(data.draft.to.join(", "))
            }
            if (data.draft.cc?.length > 0) {
              setCcInput(data.draft.cc.join(", "))
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch draft body:", error)
      } finally {
        setIsLoadingBody(false)
      }
    }

    fetchDraftBody()
  }, [draft.draft_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Parse comma-separated email addresses
    const toEmails = toInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    const ccEmails = ccInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0)

    // IMPORTANT: Use draft.draft_id (Gmail's ID), not draft.id (database UUID)
    await onSave(draft.draft_id, {
      ...formData,
      to: toEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
    })
  }

  const openInGmail = () => {
    window.open(
      `https://mail.google.com/mail/u/0/#drafts/${draft.draft_id}`,
      "_blank"
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-[#333]">
        <h3 className="text-sm font-semibold text-black dark:text-white">Edit Draft</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#333] transition-colors text-gray-600 dark:text-gray-400"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* To */}
      <div className="space-y-1">
        <label htmlFor="to" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          To
        </label>
        <input
          id="to"
          type="text"
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          placeholder="recipient@example.com"
          disabled={isSaving || isLoadingBody}
          className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white disabled:opacity-50"
        />
      </div>

      {/* CC */}
      <div className="space-y-1">
        <label htmlFor="cc" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          CC
        </label>
        <input
          id="cc"
          type="text"
          value={ccInput}
          onChange={(e) => setCcInput(e.target.value)}
          placeholder="cc@example.com (optional)"
          disabled={isSaving || isLoadingBody}
          className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white disabled:opacity-50"
        />
      </div>

      {/* Subject */}
      <div className="space-y-1">
        <label htmlFor="subject" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          value={formData.subject}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subject: e.target.value }))
          }
          placeholder="Email subject"
          disabled={isSaving || isLoadingBody}
          className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white disabled:opacity-50"
        />
      </div>

      {/* Body */}
      <div className="space-y-1">
        <label htmlFor="body" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Message
        </label>
        {isLoadingBody ? (
          <div className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#222] h-[200px] flex items-center justify-center">
            <Spinner size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <textarea
            id="body"
            value={formData.body}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, body: e.target.value }))
            }
            placeholder="Email body..."
            rows={8}
            disabled={isSaving}
            className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white disabled:opacity-50 resize-none"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-[#333]">
        <button
          type="button"
          onClick={openInGmail}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-gray-300 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white transition-colors"
        >
          <ArrowSquareOut size={14} />
          Open in Gmail
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-2 text-xs font-medium rounded border border-gray-300 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isLoadingBody}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-black dark:bg-white hover:bg-transparent border border-black dark:border-white text-white dark:text-black hover:text-black dark:hover:text-white transition-all disabled:opacity-50"
        >
          {isSaving ? (
            <Spinner size={14} className="animate-spin" />
          ) : (
            <FloppyDisk size={14} />
          )}
          Save
        </button>
      </div>
    </form>
  )
}
