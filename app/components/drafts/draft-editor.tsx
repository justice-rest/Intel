"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, X, ExternalLink } from "lucide-react"
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
  const [formData, setFormData] = useState<DraftFormData>({
    to: draft.to_recipients,
    cc: draft.cc_recipients || [],
    subject: draft.subject,
    body: "", // Will be fetched from Gmail API
    threadId: draft.thread_id,
  })

  const [toInput, setToInput] = useState(draft.to_recipients.join(", "))
  const [ccInput, setCcInput] = useState((draft.cc_recipients || []).join(", "))

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

    await onSave(draft.id, {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold">Edit Draft</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="size-4 mr-1" />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Save className="size-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* To */}
      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="text"
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          placeholder="recipient@example.com"
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground">
          Separate multiple addresses with commas
        </p>
      </div>

      {/* CC */}
      <div className="space-y-1.5">
        <Label htmlFor="cc">CC</Label>
        <Input
          id="cc"
          type="text"
          value={ccInput}
          onChange={(e) => setCcInput(e.target.value)}
          placeholder="cc@example.com (optional)"
          disabled={isSaving}
        />
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          type="text"
          value={formData.subject}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subject: e.target.value }))
          }
          placeholder="Email subject"
          disabled={isSaving}
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          value={formData.body}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, body: e.target.value }))
          }
          placeholder="Email body..."
          rows={10}
          disabled={isSaving}
          className="resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openInGmail}
        >
          <ExternalLink className="size-4 mr-1" />
          Open in Gmail
        </Button>
        <p className="text-xs text-muted-foreground self-center">
          Changes are saved to Gmail. Review and send from Gmail.
        </p>
      </div>
    </form>
  )
}
