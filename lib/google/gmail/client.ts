/**
 * Gmail API Client
 * Handles inbox reading, thread viewing, and draft creation
 */

import { getValidAccessToken } from "../oauth/token-manager"
import {
  GOOGLE_OAUTH_CONFIG,
  GMAIL_CONFIG,
  GOOGLE_RATE_LIMITS,
  calculateRetryDelay,
  RETRY_CONFIG,
} from "../config"
import type {
  GmailMessage,
  GmailThread,
  GmailDraft,
  GmailDraftCreate,
  GmailListResponse,
  ParsedEmail,
  InboxSummary,
} from "../types"
import { GoogleApiError, RateLimitError } from "../types"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Make an authenticated request to the Gmail API
 */
async function gmailRequest<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getValidAccessToken(userId)

  const url = `${GOOGLE_OAUTH_CONFIG.gmailApiUrl}/users/me${endpoint}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(GOOGLE_OAUTH_CONFIG.timeout),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check for rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") || "60",
            10
          )
          throw new RateLimitError(
            "Gmail API rate limit exceeded",
            retryAfter * 1000
          )
        }

        throw new GoogleApiError(
          `Gmail API error: ${errorData.error?.message || response.statusText}`,
          response.status,
          errorData.error?.code,
          response.status >= 500 || response.status === 429
        )
      }

      return response.json()
    } catch (error) {
      lastError = error as Error

      // Don't retry on non-retryable errors
      if (
        error instanceof RateLimitError ||
        (error instanceof GoogleApiError && !error.retryable)
      ) {
        throw error
      }

      // Wait before retry
      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, calculateRetryDelay(attempt))
        )
      }
    }
  }

  throw lastError || new Error("Gmail API request failed after retries")
}

/**
 * Add rate limiting delay between requests
 */
async function rateLimitDelay(): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, GOOGLE_RATE_LIMITS.gmail.delayBetweenRequests)
  )
}

// ============================================================================
// MESSAGE PARSING
// ============================================================================

/**
 * Decode base64url encoded content
 */
function decodeBase64Url(data: string): string {
  // Replace base64url chars with base64 chars
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  // Pad if necessary
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, "base64").toString("utf-8")
}

/**
 * Get header value from message
 */
function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value || ""
}

/**
 * Extract text body from message payload
 */
function extractTextBody(payload: GmailMessage["payload"]): string {
  // If the body has data, decode it
  if (payload.body.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Check parts for text/plain or text/html
  if (payload.parts) {
    // First look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        return decodeBase64Url(part.body.data)
      }
    }

    // Fall back to text/html
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body.data) {
        const html = decodeBase64Url(part.body.data)
        // Basic HTML stripping
        return html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }
    }

    // Check nested parts (multipart/alternative)
    for (const part of payload.parts) {
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.mimeType === "text/plain" && nestedPart.body.data) {
            return decodeBase64Url(nestedPart.body.data)
          }
        }
      }
    }
  }

  return ""
}

/**
 * Parse a Gmail message into a friendly format
 */
function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc") || undefined,
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    snippet: message.snippet,
    body: extractTextBody(message.payload),
    hasAttachments: Boolean(
      message.payload.parts?.some((p) => p.filename && p.filename.length > 0)
    ),
    labels: message.labelIds,
    isUnread: message.labelIds.includes("UNREAD"),
  }
}

/**
 * Parse a message into inbox summary (lighter format for listing)
 */
function parseInboxSummary(message: GmailMessage): InboxSummary {
  const headers = message.payload.headers

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    snippet: message.snippet,
    hasAttachments: Boolean(
      message.payload.parts?.some((p) => p.filename && p.filename.length > 0)
    ),
  }
}

// ============================================================================
// INBOX OPERATIONS
// ============================================================================

/**
 * Get recent inbox messages
 */
export async function getInbox(
  userId: string,
  options: {
    maxResults?: number
    query?: string
    pageToken?: string
  } = {}
): Promise<{
  emails: InboxSummary[]
  nextPageToken?: string
}> {
  const maxResults = Math.min(
    options.maxResults || GMAIL_CONFIG.defaultInboxCount,
    GMAIL_CONFIG.maxInboxCount
  )

  // Build query - default to inbox
  const queryParts = ["in:inbox"]
  if (options.query) {
    queryParts.push(options.query)
  }

  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: queryParts.join(" "),
  })

  if (options.pageToken) {
    params.set("pageToken", options.pageToken)
  }

  // Get message list
  const listResponse = await gmailRequest<GmailListResponse<unknown>>(
    userId,
    `/messages?${params.toString()}`
  )

  if (!listResponse.messages || listResponse.messages.length === 0) {
    return { emails: [] }
  }

  // Fetch full message details for each
  const emails: InboxSummary[] = []

  for (const msg of listResponse.messages) {
    await rateLimitDelay()

    const message = await gmailRequest<GmailMessage>(
      userId,
      `/messages/${msg.id}?format=full`
    )

    emails.push(parseInboxSummary(message))
  }

  return {
    emails,
    nextPageToken: listResponse.nextPageToken,
  }
}

/**
 * Get sent emails for style analysis
 */
export async function getSentEmails(
  userId: string,
  maxResults: number = GMAIL_CONFIG.emailsToAnalyzeForStyle
): Promise<ParsedEmail[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "in:sent",
  })

  const listResponse = await gmailRequest<GmailListResponse<unknown>>(
    userId,
    `/messages?${params.toString()}`
  )

  if (!listResponse.messages || listResponse.messages.length === 0) {
    return []
  }

  const emails: ParsedEmail[] = []

  for (const msg of listResponse.messages) {
    await rateLimitDelay()

    try {
      const message = await gmailRequest<GmailMessage>(
        userId,
        `/messages/${msg.id}?format=full`
      )

      emails.push(parseMessage(message))
    } catch (error) {
      // Skip messages that fail to load
      console.error(`[Gmail] Failed to load sent message ${msg.id}:`, error)
    }
  }

  return emails
}

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

/**
 * Get a full email thread
 */
export async function getThread(
  userId: string,
  threadId: string
): Promise<{
  threadId: string
  messageCount: number
  messages: ParsedEmail[]
}> {
  const thread = await gmailRequest<GmailThread>(
    userId,
    `/threads/${threadId}?format=full`
  )

  const messages = thread.messages.map(parseMessage)

  return {
    threadId: thread.id,
    messageCount: messages.length,
    messages,
  }
}

/**
 * Get a single message
 */
export async function getMessage(
  userId: string,
  messageId: string
): Promise<ParsedEmail> {
  const message = await gmailRequest<GmailMessage>(
    userId,
    `/messages/${messageId}?format=full`
  )

  return parseMessage(message)
}

// ============================================================================
// DRAFT OPERATIONS
// ============================================================================

/**
 * Encode email content to RFC 2822 format
 */
function encodeEmail(draft: GmailDraftCreate, fromEmail: string): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`

  const lines: string[] = []

  // Headers
  lines.push(`From: ${fromEmail}`)
  lines.push(`To: ${draft.to.join(", ")}`)

  if (draft.cc && draft.cc.length > 0) {
    lines.push(`Cc: ${draft.cc.join(", ")}`)
  }

  if (draft.bcc && draft.bcc.length > 0) {
    lines.push(`Bcc: ${draft.bcc.join(", ")}`)
  }

  // Encode subject for non-ASCII characters (RFC 2047)
  const encodedSubject = Buffer.from(draft.subject).toString("utf-8")
    .split("")
    .some((c) => c.charCodeAt(0) > 127)
    ? `=?UTF-8?B?${Buffer.from(draft.subject).toString("base64")}?=`
    : draft.subject

  lines.push(`Subject: ${encodedSubject}`)

  // Threading headers
  if (draft.inReplyTo) {
    lines.push(`In-Reply-To: ${draft.inReplyTo}`)
  }

  if (draft.references) {
    lines.push(`References: ${draft.references}`)
  }

  lines.push("MIME-Version: 1.0")
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
  lines.push("")

  // Plain text part
  lines.push(`--${boundary}`)
  lines.push("Content-Type: text/plain; charset=UTF-8")
  lines.push("Content-Transfer-Encoding: base64")
  lines.push("")
  lines.push(Buffer.from(draft.body).toString("base64"))
  lines.push("")

  // HTML part (simple conversion)
  const htmlBody = draft.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  lines.push(`--${boundary}`)
  lines.push("Content-Type: text/html; charset=UTF-8")
  lines.push("Content-Transfer-Encoding: base64")
  lines.push("")
  lines.push(Buffer.from(`<html><body>${htmlBody}</body></html>`).toString("base64"))
  lines.push("")

  lines.push(`--${boundary}--`)

  // Join and encode to base64url
  const rawEmail = lines.join("\r\n")
  return Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * Create a draft email
 */
export async function createDraft(
  userId: string,
  draft: GmailDraftCreate,
  fromEmail: string
): Promise<GmailDraft> {
  // Validate inputs
  if (!draft.to || draft.to.length === 0) {
    throw new Error("At least one recipient is required")
  }

  if (draft.to.length > GMAIL_CONFIG.maxRecipientsPerDraft) {
    throw new Error(
      `Maximum ${GMAIL_CONFIG.maxRecipientsPerDraft} recipients allowed`
    )
  }

  if (draft.subject && draft.subject.length > GMAIL_CONFIG.maxSubjectLength) {
    throw new Error(
      `Subject must be less than ${GMAIL_CONFIG.maxSubjectLength} characters`
    )
  }

  if (draft.body && draft.body.length > GMAIL_CONFIG.maxBodyLength) {
    throw new Error(
      `Body must be less than ${GMAIL_CONFIG.maxBodyLength} characters`
    )
  }

  // Encode the email
  const raw = encodeEmail(draft, fromEmail)

  // Create the draft
  const response = await gmailRequest<GmailDraft>(userId, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw,
        threadId: draft.threadId,
      },
    }),
  })

  return response
}

/**
 * Update an existing draft
 */
export async function updateDraft(
  userId: string,
  draftId: string,
  draft: GmailDraftCreate,
  fromEmail: string
): Promise<GmailDraft> {
  // Validate inputs (same as create)
  if (!draft.to || draft.to.length === 0) {
    throw new Error("At least one recipient is required")
  }

  // Encode the email
  const raw = encodeEmail(draft, fromEmail)

  // Update the draft
  const response = await gmailRequest<GmailDraft>(userId, `/drafts/${draftId}`, {
    method: "PUT",
    body: JSON.stringify({
      message: {
        raw,
        threadId: draft.threadId,
      },
    }),
  })

  return response
}

/**
 * Delete a draft
 */
export async function deleteDraft(
  userId: string,
  draftId: string
): Promise<void> {
  await gmailRequest<void>(userId, `/drafts/${draftId}`, {
    method: "DELETE",
  })
}

/**
 * Get a draft by ID
 */
export async function getDraft(
  userId: string,
  draftId: string
): Promise<GmailDraft> {
  return gmailRequest<GmailDraft>(userId, `/drafts/${draftId}?format=full`)
}

/**
 * Get draft parsed for editing (includes body text)
 */
export async function getDraftForEdit(
  userId: string,
  draftId: string
): Promise<{
  id: string
  to: string[]
  cc: string[]
  subject: string
  body: string
  threadId: string | null
}> {
  const draft = await getDraft(userId, draftId)
  const headers = draft.message.payload.headers

  const to = getHeader(headers, "To")
  const cc = getHeader(headers, "Cc")

  return {
    id: draft.id,
    to: to ? to.split(",").map((e) => e.trim()) : [],
    cc: cc ? cc.split(",").map((e) => e.trim()) : [],
    subject: getHeader(headers, "Subject"),
    body: extractTextBody(draft.message.payload),
    threadId: draft.message.threadId || null,
  }
}

/**
 * List all drafts
 */
export async function listDrafts(
  userId: string,
  maxResults: number = 10
): Promise<Array<{
  id: string
  to: string
  subject: string
  snippet: string
}>> {
  const response = await gmailRequest<GmailListResponse<unknown>>(
    userId,
    `/drafts?maxResults=${maxResults}`
  )

  if (!response.drafts || response.drafts.length === 0) {
    return []
  }

  const drafts: Array<{
    id: string
    to: string
    subject: string
    snippet: string
  }> = []

  for (const draftRef of response.drafts) {
    await rateLimitDelay()

    try {
      const draft = await getDraft(userId, draftRef.id)
      const headers = draft.message.payload.headers

      drafts.push({
        id: draft.id,
        to: getHeader(headers, "To"),
        subject: getHeader(headers, "Subject"),
        snippet: draft.message.snippet,
      })
    } catch (error) {
      console.error(`[Gmail] Failed to load draft ${draftRef.id}:`, error)
    }
  }

  return drafts
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the user's Gmail profile (email address)
 */
export async function getProfile(userId: string): Promise<{
  emailAddress: string
  messagesTotal: number
  threadsTotal: number
  historyId: string
}> {
  return gmailRequest(userId, "/profile")
}

/**
 * Search emails with a query
 */
export async function searchEmails(
  userId: string,
  query: string,
  maxResults: number = 10
): Promise<InboxSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: query,
  })

  const listResponse = await gmailRequest<GmailListResponse<unknown>>(
    userId,
    `/messages?${params.toString()}`
  )

  if (!listResponse.messages || listResponse.messages.length === 0) {
    return []
  }

  const emails: InboxSummary[] = []

  for (const msg of listResponse.messages) {
    await rateLimitDelay()

    try {
      const message = await gmailRequest<GmailMessage>(
        userId,
        `/messages/${msg.id}?format=full`
      )

      emails.push(parseInboxSummary(message))
    } catch (error) {
      console.error(`[Gmail] Failed to load message ${msg.id}:`, error)
    }
  }

  return emails
}

/**
 * Get unread count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const params = new URLSearchParams({
    maxResults: "1",
    q: "in:inbox is:unread",
  })

  const response = await gmailRequest<GmailListResponse<unknown>>(
    userId,
    `/messages?${params.toString()}`
  )

  return response.resultSizeEstimate || 0
}
