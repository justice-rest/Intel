/**
 * Message Payload Optimizer
 *
 * Reduces payload size for /api/chat requests to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
 * This module optimizes message payloads without breaking functionality:
 * - Limits message history to recent messages only
 * - Removes blob URLs from attachments (not needed server-side)
 * - Truncates large tool results
 * - Preserves essential data for AI model context
 */

import type { Message } from "@ai-sdk/react"
import { MAX_MESSAGES_IN_PAYLOAD, MAX_TOOL_RESULT_SIZE, MAX_MESSAGE_CONTENT_SIZE } from "./config"

/**
 * Sanitize text content to prevent JSON serialization errors
 * Removes or escapes problematic characters that break JSON parsing
 */
function sanitizeTextContent(text: string): string {
  if (!text || typeof text !== "string") return text

  try {
    // Test if the text can be safely JSON stringified
    JSON.stringify({ test: text })
    return text
  } catch {
    // If JSON.stringify fails, sanitize the text
    return text
      .replace(/\\/g, "\\\\") // Escape backslashes first
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\n/g, "\\n") // Escape newlines
      .replace(/\r/g, "\\r") // Escape carriage returns
      .replace(/\t/g, "\\t") // Escape tabs
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
  }
}

/**
 * Truncate message content if it exceeds the maximum size
 * Prevents context window overflow from large PDF extractions
 *
 * @param content - The text content to potentially truncate
 * @param hasAttachments - Whether this message has file attachments (PDFs need more aggressive truncation)
 */
function truncateMessageContent(content: string, hasAttachments: boolean = false): string {
  // For messages with attachments (especially PDFs), use even more aggressive truncation
  // because the AI will also be processing the file content, leaving less room for text
  const maxSize = hasAttachments
    ? Math.floor(MAX_MESSAGE_CONTENT_SIZE * 0.5) // 50K chars = ~12.5K tokens for messages with files
    : MAX_MESSAGE_CONTENT_SIZE // 100K chars = ~25K tokens for regular messages

  if (!content || content.length <= maxSize) {
    return content
  }

  const truncated = content.substring(0, maxSize)
  const tokensRemoved = Math.round((content.length - maxSize) / 4)

  // Log truncation for debugging
  console.log(`[Payload Optimizer] Truncated message content: ${content.length} chars -> ${maxSize} chars (removed ~${tokensRemoved.toLocaleString()} tokens, hasAttachments: ${hasAttachments})`)

  return (
    truncated +
    `\n\n[Content truncated to prevent context window overflow. Removed approximately ${tokensRemoved.toLocaleString()} tokens.${hasAttachments ? ' File attachments require additional context space.' : ''} Consider breaking this into smaller chunks or summarizing the content before sending.]`
  )
}

/**
 * Clean attachment URLs by removing blob URLs
 * Blob URLs are client-side only and shouldn't be sent to server
 */
function cleanAttachments(
  attachments?: Array<{ url?: string; name?: string; contentType?: string; [key: string]: any }>
): Array<{ url: string; name: string; contentType: string }> | undefined {
  if (!attachments || attachments.length === 0) return undefined

  // Filter out attachments with blob URLs and ensure required fields
  const cleaned = attachments
    .filter((attachment) => {
      return (
        attachment.url &&
        !attachment.url.startsWith("blob:") &&
        attachment.name &&
        attachment.contentType
      )
    })
    .map((attachment) => ({
      url: attachment.url as string,
      name: sanitizeTextContent(attachment.name as string),
      contentType: attachment.contentType as string,
    }))

  return cleaned.length > 0 ? cleaned : undefined
}

/**
 * Truncate tool result content if it exceeds the maximum size
 * Keeps metadata intact while reducing content length
 */
function truncateToolResult(result: any): any {
  if (!result) return result

  // Handle different result types
  if (typeof result === "string") {
    const sanitized = sanitizeTextContent(result)
    return sanitized.length > MAX_TOOL_RESULT_SIZE
      ? sanitized.substring(0, MAX_TOOL_RESULT_SIZE) +
          "\n\n[Content truncated to prevent payload size limit...]"
      : sanitized
  }

  if (typeof result === "object") {
    const truncated = { ...result }

    // Truncate common content fields
    const contentFields = ["content", "text", "results", "data", "body"]
    for (const field of contentFields) {
      if (truncated[field] && typeof truncated[field] === "string") {
        const content = sanitizeTextContent(truncated[field] as string)
        if (content.length > MAX_TOOL_RESULT_SIZE) {
          truncated[field] =
            content.substring(0, MAX_TOOL_RESULT_SIZE) +
            "\n\n[Content truncated to prevent payload size limit...]"
        } else {
          truncated[field] = content
        }
      }
    }

    // Handle array of results (like search results)
    if (Array.isArray(truncated.results)) {
      let totalSize = 0
      truncated.results = truncated.results.filter((item: any) => {
        try {
          const itemStr = JSON.stringify(item)
          totalSize += itemStr.length
          return totalSize <= MAX_TOOL_RESULT_SIZE
        } catch {
          // Skip items that can't be serialized
          return false
        }
      })
    }

    return truncated
  }

  return result
}

/**
 * Clean message content to reduce payload size
 * Removes blob URLs, truncates large tool results, keeps essential data
 */
function cleanMessage(message: Message): Message {
  // Check if this message has attachments (needs more aggressive truncation)
  const hasAttachments = !!(
    message.experimental_attachments &&
    Array.isArray(message.experimental_attachments) &&
    message.experimental_attachments.length > 0
  )

  const cleaned: Message = {
    ...message,
    // Sanitize and truncate text content if it's a string
    content: typeof message.content === "string"
      ? truncateMessageContent(sanitizeTextContent(message.content), hasAttachments)
      : message.content,
    // Clean attachments
    experimental_attachments: cleanAttachments(
      message.experimental_attachments as any
    ),
  }

  // Clean tool invocations if present in content
  if (Array.isArray(message.content)) {
    cleaned.content = message.content.map((part: any) => {
      // Sanitize and truncate text parts
      if (part.type === "text" && typeof part.text === "string") {
        return {
          ...part,
          text: truncateMessageContent(sanitizeTextContent(part.text), hasAttachments),
        }
      }
      if (part.type === "tool-invocation" && part.toolInvocation?.result) {
        return {
          ...part,
          toolInvocation: {
            ...part.toolInvocation,
            result: truncateToolResult(part.toolInvocation.result),
          },
        }
      }
      if (part.type === "tool-result" && part.result) {
        return {
          ...part,
          result: truncateToolResult(part.result),
        }
      }
      return part
    }) as any // Type assertion needed due to AI SDK's complex content types
  }

  return cleaned
}

/**
 * Optimize message payload for API request
 *
 * Strategies:
 * 1. Limit to recent messages (keeps conversation context manageable)
 * 2. Remove blob URLs from attachments
 * 3. Truncate large tool results
 * 4. Preserve message structure and roles
 *
 * @param messages - Full message history
 * @returns Optimized messages array safe for API request
 */
export function optimizeMessagePayload(messages: Message[]): Message[] {
  if (!messages || messages.length === 0) return []

  // Strategy 1: Limit to recent messages
  // Keep system messages + recent conversation
  const systemMessages = messages.filter((m) => m.role === "system")
  const conversationMessages = messages.filter((m) => m.role !== "system")

  // Take the most recent messages up to the limit
  const recentMessages = conversationMessages.slice(
    Math.max(0, conversationMessages.length - MAX_MESSAGES_IN_PAYLOAD)
  )

  // Combine system messages with recent conversation
  const limitedMessages = [...systemMessages, ...recentMessages]

  // Strategy 2 & 3: Clean each message
  const optimizedMessages = limitedMessages.map(cleanMessage)

  return optimizedMessages
}

/**
 * Calculate approximate payload size in bytes
 * Used for monitoring and debugging
 */
export function estimatePayloadSize(messages: Message[]): number {
  try {
    return JSON.stringify(messages).length
  } catch {
    return 0
  }
}

/**
 * Check if payload optimization reduced the size significantly
 * Returns reduction percentage
 */
export function calculateReduction(
  original: Message[],
  optimized: Message[]
): number {
  const originalSize = estimatePayloadSize(original)
  const optimizedSize = estimatePayloadSize(optimized)

  if (originalSize === 0) return 0

  return Math.round(((originalSize - optimizedSize) / originalSize) * 100)
}
