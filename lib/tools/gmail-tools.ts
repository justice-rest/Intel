/**
 * Gmail AI Tools
 * Tools for AI to interact with user's Gmail
 *
 * NOTE: AI can ONLY create drafts, not send emails directly.
 * Users must manually review and send drafts from Gmail.
 */

import { tool } from "ai"
import { z } from "zod"
import {
  getInbox,
  getThread,
  createDraft,
  listDrafts,
  searchEmails,
  getProfile,
  getWritingStyleProfile,
  buildStylePrompt,
  hasGmailAccess,
} from "@/lib/google"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"

// ============================================================================
// TOOL FACTORIES
// ============================================================================

/**
 * Create Gmail inbox reading tool bound to a specific user
 */
export const createGmailInboxTool = (userId: string) =>
  tool({
    description:
      "Read the user's recent Gmail inbox messages. " +
      "Returns a list of recent emails with sender, subject, date, and snippet. " +
      "Use this when the user asks about their emails, inbox, or recent messages. " +
      "You can optionally filter by a search query (e.g., 'from:john' or 'is:unread').",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Optional Gmail search query to filter results (e.g., 'from:john', 'subject:meeting', 'is:unread')"
        ),
      maxResults: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of emails to return (default: 10, max: 50)"),
    }),
    execute: async ({ query, maxResults }) => {
      try {
        // Check access
        const hasAccess = await hasGmailAccess(userId)
        if (!hasAccess) {
          return {
            success: false,
            error:
              "Gmail is not connected. Please connect your Google account in Settings.",
            emails: [],
          }
        }

        const result = await getInbox(userId, {
          query,
          maxResults: Math.min(maxResults, 50),
        })

        if (result.emails.length === 0) {
          return {
            success: true,
            message: "No emails found matching your criteria.",
            emails: [],
            count: 0,
          }
        }

        return {
          success: true,
          emails: result.emails,
          count: result.emails.length,
          message: `Found ${result.emails.length} email${result.emails.length === 1 ? "" : "s"}.`,
          hasMore: Boolean(result.nextPageToken),
        }
      } catch (error) {
        console.error("[GmailInboxTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to read inbox",
          emails: [],
        }
      }
    },
  })

/**
 * Create Gmail thread reading tool bound to a specific user
 */
export const createGmailThreadTool = (userId: string) =>
  tool({
    description:
      "Read a full email thread/conversation. " +
      "Returns all messages in the thread with full content. " +
      "Use this when the user wants to see a complete email conversation " +
      "or when you need full context to draft a reply.",
    inputSchema: z.object({
      threadId: z
        .string()
        .describe(
          "The thread ID to read (from inbox results or user-provided)"
        ),
    }),
    execute: async ({ threadId }) => {
      try {
        const hasAccess = await hasGmailAccess(userId)
        if (!hasAccess) {
          return {
            success: false,
            error:
              "Gmail is not connected. Please connect your Google account in Settings.",
            messages: [],
          }
        }

        const result = await getThread(userId, threadId)

        return {
          success: true,
          threadId: result.threadId,
          messageCount: result.messageCount,
          messages: result.messages,
          message: `Thread contains ${result.messageCount} message${result.messageCount === 1 ? "" : "s"}.`,
        }
      } catch (error) {
        console.error("[GmailThreadTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to read email thread",
          messages: [],
        }
      }
    },
  })

/**
 * Create Gmail draft creation tool bound to a specific user
 * IMPORTANT: This ONLY creates drafts - it CANNOT send emails
 */
export const createGmailDraftTool = (userId: string, chatId?: string) =>
  tool({
    description:
      "Create an email draft in the user's Gmail. " +
      "IMPORTANT: This creates a DRAFT only - the user must manually review and send it from Gmail. " +
      "The AI cannot send emails directly. " +
      "The draft will match the user's writing style if style analysis has been done. " +
      "Use this when the user asks you to draft, compose, or write an email.",
    inputSchema: z.object({
      to: z
        .array(z.string().email())
        .describe("Email addresses of recipients"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body content (plain text)"),
      cc: z
        .array(z.string().email())
        .optional()
        .describe("CC recipients (optional)"),
      threadId: z
        .string()
        .optional()
        .describe(
          "Thread ID for replies (optional - include to keep email in the same thread)"
        ),
    }),
    execute: async ({ to, subject, body, cc, threadId }) => {
      try {
        const hasAccess = await hasGmailAccess(userId)
        if (!hasAccess) {
          return {
            success: false,
            error:
              "Gmail is not connected. Please connect your Google account in Settings.",
          }
        }

        // Get user's email address
        const profile = await getProfile(userId)

        // Create the draft
        const draft = await createDraft(
          userId,
          {
            to,
            cc,
            subject,
            body,
            threadId,
          },
          profile.emailAddress
        )

        // Store draft record in database
        await storeDraftRecord(userId, {
          draftId: draft.id,
          threadId,
          toRecipients: to,
          ccRecipients: cc,
          subject,
          bodyPreview: body.slice(0, 200),
          chatId,
        })

        return {
          success: true,
          draftId: draft.id,
          to,
          subject,
          message:
            "Draft created successfully! The user can review and send it from Gmail. " +
            "Remind the user: 'I've created a draft for you. Please check your Gmail Drafts folder to review and send it.'",
          gmailDraftsUrl: "https://mail.google.com/mail/u/0/#drafts",
        }
      } catch (error) {
        console.error("[GmailDraftTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create email draft",
        }
      }
    },
  })

/**
 * Create Gmail draft listing tool
 */
export const createGmailListDraftsTool = (userId: string) =>
  tool({
    description:
      "List the user's pending Gmail drafts. " +
      "Use this when the user asks about their drafts or wants to see what emails are waiting to be sent.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of drafts to return (default: 10)"),
    }),
    execute: async ({ limit }) => {
      try {
        const hasAccess = await hasGmailAccess(userId)
        if (!hasAccess) {
          return {
            success: false,
            error:
              "Gmail is not connected. Please connect your Google account in Settings.",
            drafts: [],
          }
        }

        const drafts = await listDrafts(userId, limit)

        if (drafts.length === 0) {
          return {
            success: true,
            message: "No drafts found.",
            drafts: [],
            count: 0,
          }
        }

        return {
          success: true,
          drafts,
          count: drafts.length,
          message: `Found ${drafts.length} draft${drafts.length === 1 ? "" : "s"}.`,
        }
      } catch (error) {
        console.error("[GmailListDraftsTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to list drafts",
          drafts: [],
        }
      }
    },
  })

/**
 * Create Gmail search tool
 */
export const createGmailSearchTool = (userId: string) =>
  tool({
    description:
      "Search the user's Gmail for specific emails. " +
      "Supports Gmail's powerful search syntax. " +
      "Use this when the user wants to find specific emails by sender, subject, date, or content.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Gmail search query. Examples: " +
            "'from:john@example.com', 'subject:invoice', 'has:attachment', " +
            "'after:2024/01/01', 'is:unread', 'in:sent'"
        ),
      maxResults: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results (default: 10, max: 50)"),
    }),
    execute: async ({ query, maxResults }) => {
      try {
        const hasAccess = await hasGmailAccess(userId)
        if (!hasAccess) {
          return {
            success: false,
            error:
              "Gmail is not connected. Please connect your Google account in Settings.",
            emails: [],
          }
        }

        const emails = await searchEmails(userId, query, Math.min(maxResults, 50))

        if (emails.length === 0) {
          return {
            success: true,
            message: `No emails found matching "${query}".`,
            emails: [],
            count: 0,
            query,
          }
        }

        return {
          success: true,
          emails,
          count: emails.length,
          query,
          message: `Found ${emails.length} email${emails.length === 1 ? "" : "s"} matching "${query}".`,
        }
      } catch (error) {
        console.error("[GmailSearchTool] Error:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to search emails",
          emails: [],
        }
      }
    },
  })

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Store draft record in database for tracking
 */
async function storeDraftRecord(
  userId: string,
  data: {
    draftId: string
    threadId?: string
    toRecipients: string[]
    ccRecipients?: string[]
    subject: string
    bodyPreview: string
    chatId?: string
  }
): Promise<void> {
  if (!isSupabaseEnabled) return

  const supabase = await createClient()
  if (!supabase) return

  try {
    // Using 'any' cast as table is not yet in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("gmail_drafts").insert({
      user_id: userId,
      draft_id: data.draftId,
      thread_id: data.threadId || null,
      to_recipients: data.toRecipients,
      cc_recipients: data.ccRecipients || [],
      subject: data.subject,
      body_preview: data.bodyPreview,
      chat_id: data.chatId || null,
      created_by_ai: true,
      status: "pending",
    })
  } catch (error) {
    console.error("[GmailTools] Failed to store draft record:", error)
  }
}

/**
 * Get writing style system prompt for draft generation
 */
export async function getWritingStyleSystemPrompt(
  userId: string
): Promise<string | null> {
  try {
    const profile = await getWritingStyleProfile(userId)
    if (!profile) return null
    return buildStylePrompt(profile)
  } catch {
    return null
  }
}

// ============================================================================
// TOOL BUNDLE
// ============================================================================

/**
 * Create all Gmail tools for a user
 */
export function createGmailTools(userId: string, chatId?: string) {
  return {
    gmail_read_inbox: createGmailInboxTool(userId),
    gmail_read_thread: createGmailThreadTool(userId),
    gmail_create_draft: createGmailDraftTool(userId, chatId),
    gmail_list_drafts: createGmailListDraftsTool(userId),
    gmail_search: createGmailSearchTool(userId),
  }
}

/**
 * Tool names for reference
 */
export const GMAIL_TOOL_NAMES = {
  READ_INBOX: "gmail_read_inbox",
  READ_THREAD: "gmail_read_thread",
  CREATE_DRAFT: "gmail_create_draft",
  LIST_DRAFTS: "gmail_list_drafts",
  SEARCH: "gmail_search",
} as const

/**
 * Check if Gmail tools should be enabled (based on configuration)
 */
export function shouldEnableGmailTools(): boolean {
  // Check if Google integration is configured at environment level
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const enabled = process.env.GOOGLE_INTEGRATION_ENABLED !== "false"
  const gmailEnabled = process.env.GMAIL_ENABLED !== "false"

  return Boolean(clientId && clientSecret && enabled && gmailEnabled)
}

/**
 * Check if a specific user has Gmail access
 */
export async function hasUserGmailAccess(userId: string): Promise<boolean> {
  if (!shouldEnableGmailTools()) return false
  return hasGmailAccess(userId)
}
