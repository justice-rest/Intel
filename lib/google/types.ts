/**
 * Google Integration Types
 * TypeScript definitions for Gmail and Google Drive integrations
 */

// ============================================================================
// CONNECTION STATUS TYPES
// ============================================================================

export type GoogleConnectionStatus =
  | "disconnected"
  | "connected"
  | "expired"
  | "revoked"
  | "error"

export interface GoogleIntegrationStatus {
  connected: boolean
  status: GoogleConnectionStatus
  googleEmail?: string
  scopes: string[]
  expiresAt?: string
  lastRefreshAt?: string
  errorMessage?: string
  pendingDrafts: number
  indexedDocuments: number
  styleAnalyzedAt?: string
  emailsAnalyzed?: number
}

// ============================================================================
// OAUTH TYPES
// ============================================================================

export interface GoogleOAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

export interface GoogleOAuthTokensEncrypted {
  access_token_encrypted: string
  access_token_iv: string
  refresh_token_encrypted: string
  refresh_token_iv: string
  expires_at: string
  scopes: string[]
  google_email: string
  google_id: string
  status: GoogleConnectionStatus
  last_refresh_at: string | null
  last_error: string | null
}

export interface GoogleUserInfo {
  id: string
  email: string
  name?: string
  picture?: string
}

export interface GoogleOAuthState {
  userId: string
  timestamp: number
  nonce: string
}

// ============================================================================
// GMAIL TYPES
// ============================================================================

export interface GmailMessageHeader {
  name: string
  value: string
}

export interface GmailMessageBody {
  attachmentId?: string
  size: number
  data?: string // base64url encoded
}

export interface GmailMessagePart {
  partId: string
  mimeType: string
  filename?: string
  headers: GmailMessageHeader[]
  body: GmailMessageBody
  parts?: GmailMessagePart[]
}

export interface GmailMessagePayload {
  partId?: string
  mimeType: string
  filename?: string
  headers: GmailMessageHeader[]
  body: GmailMessageBody
  parts?: GmailMessagePart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  historyId: string
  internalDate: string // milliseconds since epoch as string
  payload: GmailMessagePayload
  sizeEstimate: number
  raw?: string // base64url encoded full message
}

export interface GmailThread {
  id: string
  historyId: string
  messages: GmailMessage[]
}

export interface GmailDraft {
  id: string
  message: GmailMessage
}

export interface GmailDraftCreate {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  threadId?: string // For replies
  inReplyTo?: string // Message-ID header for threading
  references?: string // References header for threading
}

export interface GmailDraftUpdate extends GmailDraftCreate {
  draftId: string
}

export interface GmailListResponse<T> {
  messages?: Array<{ id: string; threadId: string }>
  drafts?: Array<{ id: string; message: { id: string; threadId: string } }>
  threads?: Array<{ id: string; historyId: string; snippet: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

export interface GmailLabel {
  id: string
  name: string
  messageListVisibility?: "show" | "hide"
  labelListVisibility?: "labelShow" | "labelHide" | "labelShowIfUnread"
  type: "system" | "user"
}

// Parsed email for display
export interface ParsedEmail {
  id: string
  threadId: string
  from: string
  to: string
  cc?: string
  subject: string
  date: string
  snippet: string
  body: string
  hasAttachments: boolean
  labels: string[]
  isUnread: boolean
}

// Inbox summary for AI
export interface InboxSummary {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  date: string
  snippet: string
  hasAttachments: boolean
}

// ============================================================================
// GMAIL DRAFT TRACKING TYPES
// ============================================================================

export type DraftStatus = "pending" | "sent" | "discarded" | "edited"

export interface GmailDraftRecord {
  id: string
  userId: string
  draftId: string
  threadId: string | null
  messageId: string | null
  toRecipients: string[]
  ccRecipients: string[]
  subject: string | null
  bodyPreview: string | null
  chatId: string | null
  createdByAi: boolean
  promptSummary: string | null
  idempotencyKey: string | null
  status: DraftStatus
  sentAt: string | null
  createdAt: string
}

export interface CreateDraftRecordInput {
  draftId: string
  threadId?: string
  messageId?: string
  toRecipients: string[]
  ccRecipients?: string[]
  subject?: string
  bodyPreview?: string
  chatId?: string
  promptSummary?: string
  idempotencyKey?: string
}

// ============================================================================
// WRITING STYLE TYPES
// ============================================================================

export interface GreetingPattern {
  text: string
  frequency: number
}

export interface ClosingPattern {
  text: string
  frequency: number
}

export type Formality = "casual" | "neutral" | "formal"
export type Warmth = "warm" | "neutral" | "professional"
export type Directness = "direct" | "diplomatic" | "elaborate"

export interface WritingStyleProfile {
  // Tone characteristics
  formality: Formality
  warmth: Warmth
  directness: Directness

  // Greeting patterns (ranked by frequency)
  greetings: GreetingPattern[]

  // Closing patterns (ranked by frequency)
  closings: ClosingPattern[]

  // Writing habits
  usesEmojis: boolean
  avgSentenceLength: number
  avgParagraphLength: number
  bulletPointUser: boolean

  // Signature phrases they frequently use
  signaturePhrases: string[]

  // Sample sentences for few-shot prompting
  sampleSentences: string[]

  // Analysis metadata
  analyzedAt: string
  emailsAnalyzed: number
}

export interface WritingStyleRecord {
  id: string
  userId: string
  styleProfile: WritingStyleProfile
  emailsAnalyzed: number
  lastAnalyzedAt: string | null
  formalityScore: number | null
  greetingPatterns: string[]
  closingPatterns: string[]
  commonPhrases: string[]
  sampleSentences: string[]
  usesEmojis: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// GOOGLE DRIVE TYPES
// ============================================================================

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  createdTime?: string
  size?: string // in bytes, as string
  webViewLink?: string
  webContentLink?: string
  iconLink?: string
  thumbnailLink?: string
  parents?: string[]
  owners?: Array<{ displayName: string; emailAddress: string }>
}

export interface DriveFileList {
  files: DriveFile[]
  nextPageToken?: string
  kind: string
  incompleteSearch?: boolean
}

export interface DriveFileContent {
  content: Buffer | string
  mimeType: string
  name: string
  size: number
}

export type DriveProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "needs_reindex"

export interface DriveDocumentRecord {
  id: string
  userId: string
  driveFileId: string
  driveFileName: string
  driveMimeType: string
  driveModifiedTime: string | null
  driveWebViewLink: string | null
  ragDocumentId: string | null
  status: DriveProcessingStatus
  errorMessage: string | null
  fileSize: number | null
  pageCount: number | null
  wordCount: number | null
  contentHash: string | null
  lastSyncedAt: string
  lastCheckedAt: string
  createdAt: string
  updatedAt: string
}

// Simpler type for API responses (snake_case from database)
export interface GoogleDriveDocument {
  id: string
  user_id: string
  drive_file_id: string
  drive_file_name: string
  drive_mime_type: string
  status: DriveProcessingStatus
  error_message: string | null
  file_size: number | null
  last_synced_at: string
  created_at: string
}

export interface ProcessDriveFileInput {
  fileId: string
  fileName: string
  mimeType: string
}

// Google Workspace MIME types
export const GOOGLE_WORKSPACE_MIME_TYPES = {
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  presentation: "application/vnd.google-apps.presentation",
  drawing: "application/vnd.google-apps.drawing",
  form: "application/vnd.google-apps.form",
  folder: "application/vnd.google-apps.folder",
} as const

export type GoogleWorkspaceMimeType =
  (typeof GOOGLE_WORKSPACE_MIME_TYPES)[keyof typeof GOOGLE_WORKSPACE_MIME_TYPES]

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export type AuditAction =
  | "connect"
  | "disconnect"
  | "token_refresh"
  | "token_revoked"
  | "draft_create"
  | "draft_update"
  | "draft_delete"
  | "draft_send"
  | "inbox_read"
  | "thread_read"
  | "style_analyze"
  | "drive_file_process"
  | "drive_file_delete"
  | "drive_search"
  | "error"

export type AuditStatus = "success" | "failure"

export interface AuditLogEntry {
  id: string
  userId: string | null
  action: AuditAction
  status: AuditStatus
  errorMessage: string | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface CreateAuditLogInput {
  action: AuditAction
  status: AuditStatus
  errorMessage?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface GoogleConnectResponse {
  authUrl: string
}

export interface GoogleDisconnectResponse {
  success: boolean
  message: string
}

export interface GmailInboxResponse {
  success: boolean
  emails: InboxSummary[]
  count: number
  nextPageToken?: string
}

export interface GmailThreadResponse {
  success: boolean
  threadId: string
  messageCount: number
  messages: ParsedEmail[]
}

export interface GmailCreateDraftResponse {
  success: boolean
  draftId: string
  message: string
  to: string[]
  subject: string
}

export interface GmailListDraftsResponse {
  success: boolean
  drafts: Array<{
    id: string
    to: string
    subject: string
    snippet: string
  }>
  count: number
}

export interface StyleAnalyzeResponse {
  success: boolean
  profile?: WritingStyleProfile
  emailsAnalyzed?: number
  message: string
}

export interface DriveProcessResponse {
  success: boolean
  documentId?: string
  status: DriveProcessingStatus
  message: string
}

export interface DriveSearchResponse {
  success: boolean
  results: Array<{
    document: string
    page: number
    content: string
    similarity: number
    source: string
  }>
  query: string
  resultsCount: number
  message: string
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "GoogleApiError"
  }
}

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public revoked: boolean = false
  ) {
    super(message)
    this.name = "TokenRefreshError"
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message)
    this.name = "RateLimitError"
  }
}
