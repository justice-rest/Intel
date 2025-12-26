/**
 * Gmail Drafts Types
 */

export interface GmailDraftRecord {
  id: string
  user_id: string
  draft_id: string
  thread_id?: string
  to_recipients: string[]
  cc_recipients?: string[]
  subject: string
  body_preview: string
  chat_id?: string
  created_by_ai: boolean
  status: "pending" | "sent" | "discarded" | "edited"
  created_at: string
}

export interface DraftFormData {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
}

export interface DraftsModalState {
  isOpen: boolean
  selectedDraftId: string | null
  isEditing: boolean
}
