/**
 * Application Message Types
 *
 * AI SDK v5 Migration Note:
 * In v5, UIMessage only has: id, role, metadata, parts
 * The following properties are no longer on UIMessage:
 * - content (replaced by parts array)
 * - createdAt
 * - experimental_attachments (files are in parts as FileUIPart)
 * - toolInvocations (tools are in parts as ToolUIPart)
 *
 * This file defines an extended message type for the application that includes
 * the custom properties we need for persistence and display.
 */

import type { UIMessage, UIMessagePart, UIDataTypes, UITools, FileUIPart } from "ai"
import { isTextUIPart, isFileUIPart, isToolUIPart } from "ai"

/**
 * Attachment type for file attachments
 * Replaces the old experimental_attachments from v4
 */
export interface Attachment {
  url: string
  name: string
  contentType: string
}

/**
 * Extended message type that includes application-specific properties
 * Used for persistence and backward compatibility
 */
export interface AppMessage extends UIMessage {
  /** Created timestamp for the message */
  createdAt?: Date
  /** Legacy content field for backward compatibility */
  content?: string | ContentPart[]
  /** Legacy attachments field for backward compatibility */
  experimental_attachments?: Attachment[]
  /** Message group ID for related messages */
  message_group_id?: string
  /** Model that generated this message */
  model?: string
  /** User ID who sent this message (for collaborative chats) */
  user_id?: string
}

/**
 * Content part type for mixed content (text, tool calls, etc.)
 */
export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: unknown
  result?: unknown
  toolInvocation?: {
    state: string
    step: number
    toolCallId: string
    toolName: string
    args?: unknown
    result?: unknown
  }
  reasoning?: string
  details?: unknown[]
}

/**
 * Extract text content from UIMessage parts
 * Use this instead of accessing message.content directly
 */
export function getTextContent(message: UIMessage | AppMessage): string {
  // Try legacy content first (for backward compatibility)
  const appMsg = message as AppMessage
  if (typeof appMsg.content === "string" && appMsg.content.trim()) {
    return appMsg.content
  }

  // Extract from parts
  if (!message.parts || message.parts.length === 0) {
    return ""
  }

  return message.parts
    .filter(isTextUIPart)
    .map(part => part.text)
    .join("\n")
}

/**
 * Extract attachments from UIMessage parts
 * Use this instead of accessing message.experimental_attachments directly
 */
export function getAttachments(message: UIMessage | AppMessage): Attachment[] {
  // Try legacy attachments first (for backward compatibility)
  const appMsg = message as AppMessage
  if (appMsg.experimental_attachments && appMsg.experimental_attachments.length > 0) {
    return appMsg.experimental_attachments
  }

  // Extract from parts
  if (!message.parts || message.parts.length === 0) {
    return []
  }

  return message.parts
    .filter(isFileUIPart)
    .map((part: FileUIPart) => ({
      url: part.url ?? "",
      name: part.filename ?? "file",
      contentType: part.mediaType ?? "application/octet-stream",
    }))
}

/**
 * Check if message has tool-related content
 */
export function hasToolContent(message: UIMessage | AppMessage): boolean {
  if (!message.parts || message.parts.length === 0) {
    return false
  }

  return message.parts.some(part => {
    if (isToolUIPart(part)) return true
    const partType = (part as ContentPart).type
    return partType === "tool-invocation" || partType === "tool-result" || partType === "tool-call"
  })
}

/**
 * Get created timestamp from message
 */
export function getCreatedAt(message: UIMessage | AppMessage): Date | undefined {
  const appMsg = message as AppMessage
  if (appMsg.createdAt instanceof Date) {
    return appMsg.createdAt
  }
  if (typeof appMsg.createdAt === "string") {
    return new Date(appMsg.createdAt)
  }
  return undefined
}

/**
 * Create an AppMessage with proper structure for v5
 */
export function createAppMessage(params: {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt?: Date
  attachments?: Attachment[]
  metadata?: unknown
  message_group_id?: string
  model?: string
  user_id?: string
}): AppMessage {
  const parts: UIMessagePart<UIDataTypes, UITools>[] = []

  // Add text part
  if (params.content) {
    parts.push({
      type: "text",
      text: params.content,
    })
  }

  // Add file parts from attachments
  if (params.attachments) {
    for (const attachment of params.attachments) {
      parts.push({
        type: "file",
        url: attachment.url,
        filename: attachment.name,
        mediaType: attachment.contentType,
      } as FileUIPart)
    }
  }

  return {
    id: params.id,
    role: params.role,
    parts,
    metadata: params.metadata,
    // Legacy fields for backward compatibility
    content: params.content,
    createdAt: params.createdAt ?? new Date(),
    experimental_attachments: params.attachments,
    message_group_id: params.message_group_id,
    model: params.model,
    user_id: params.user_id,
  }
}

/**
 * Convert legacy message format to AppMessage
 */
export function toAppMessage(message: {
  id: string
  role: string
  content?: string | ContentPart[]
  parts?: UIMessagePart<UIDataTypes, UITools>[]
  createdAt?: Date | string
  experimental_attachments?: Attachment[]
  message_group_id?: string
  model?: string
  user_id?: string
}): AppMessage {
  // Ensure parts exist
  let parts = message.parts || []

  // If no parts but content exists, create parts from content
  if (parts.length === 0 && message.content) {
    if (typeof message.content === "string") {
      parts = [{ type: "text", text: message.content }]
    } else if (Array.isArray(message.content)) {
      parts = message.content.map(part => {
        if (typeof part === "string") {
          return { type: "text", text: part }
        }
        if (part.type === "text") {
          return { type: "text", text: part.text || "" }
        }
        return part as unknown as UIMessagePart<UIDataTypes, UITools>
      })
    }
  }

  // Add file parts from experimental_attachments if not already in parts
  if (message.experimental_attachments && !parts.some(p => p.type === "file")) {
    for (const attachment of message.experimental_attachments) {
      parts.push({
        type: "file",
        url: attachment.url,
        filename: attachment.name,
        mediaType: attachment.contentType,
      } as FileUIPart)
    }
  }

  return {
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts,
    content: typeof message.content === "string" ? message.content : undefined,
    createdAt: message.createdAt instanceof Date
      ? message.createdAt
      : typeof message.createdAt === "string"
        ? new Date(message.createdAt)
        : undefined,
    experimental_attachments: message.experimental_attachments,
    message_group_id: message.message_group_id,
    model: message.model,
    user_id: message.user_id,
  }
}
