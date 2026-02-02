/**
 * Message Payload Optimizer
 *
 * Reduces payload size for /api/chat requests to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
 * This module optimizes message payloads without breaking functionality:
 * - Limits message history to recent messages only
 * - Removes blob URLs from attachments (not needed server-side)
 * - Truncates large tool results
 * - Preserves essential data for AI model context
 * - MODEL-AWARE: Respects model-specific context window limits
 */

import type { UIMessage } from "ai"
import type { AppMessage, ContentPart } from "@/app/types/message.types"
import { getTextContent, getAttachments } from "@/app/types/message.types"
import { MAX_MESSAGES_IN_PAYLOAD, MAX_TOOL_RESULT_SIZE, MAX_MESSAGE_CONTENT_SIZE } from "./config"

// Use AppMessage internally for backward compatibility
type Message = UIMessage | AppMessage

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count from text
 * Uses ~4 characters per token ratio (standard for English text)
 * This is a rough estimate - actual tokenization varies by model
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // ~4 characters per token for English (conservative estimate)
  return Math.ceil(text.length / 4)
}

/**
 * Estimate total tokens in a message (content + attachments + tool results)
 */
export function estimateMessageTokens(message: Message): number {
  let tokens = 0

  // Get text content using helper (handles both v4 and v5 formats)
  const textContent = getTextContent(message as AppMessage)
  if (textContent) {
    tokens += estimateTokens(textContent)
  }

  // Check parts for tool results (v5 format)
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      const partAny = part as ContentPart
      if (partAny.type === "tool-invocation" || partAny.type === "tool-result" || partAny.type?.startsWith("tool-")) {
        const result = partAny.toolInvocation?.result || partAny.result
        if (result) {
          try {
            tokens += estimateTokens(JSON.stringify(result))
          } catch {
            tokens += 500 // Default estimate for unserializable results
          }
        }
      }
    }
  }

  // Add overhead for message structure
  tokens += 10

  return tokens
}

/**
 * Estimate total tokens in all messages
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0)
}

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
  const appMsg = message as AppMessage

  // Check if this message has attachments (needs more aggressive truncation)
  const attachments = getAttachments(appMsg)
  const hasAttachments = attachments.length > 0

  // Get text content using helper
  const textContent = getTextContent(appMsg)
  const truncatedContent = truncateMessageContent(sanitizeTextContent(textContent), hasAttachments)

  // Clean parts array (v5 format)
  let cleanedParts = message.parts ? [...message.parts] : []
  if (cleanedParts.length > 0) {
    cleanedParts = cleanedParts.map((part: any) => {
      // Sanitize and truncate text parts
      if (part.type === "text" && typeof part.text === "string") {
        return {
          ...part,
          text: truncateMessageContent(sanitizeTextContent(part.text), hasAttachments),
        }
      }
      if ((part.type === "tool-invocation" || part.type?.startsWith("tool-")) && part.toolInvocation?.result) {
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
    })
  }

  // Build cleaned message with both v4 and v5 compatible fields
  const cleaned: Message = {
    ...message,
    parts: cleanedParts,
  }

  // Add legacy fields if they exist on the original message (backward compatibility)
  if (appMsg.content !== undefined) {
    (cleaned as AppMessage).content = truncatedContent
  }
  if (appMsg.experimental_attachments !== undefined) {
    (cleaned as AppMessage).experimental_attachments = cleanAttachments(appMsg.experimental_attachments)
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

// ============================================================================
// MODEL-AWARE CONTEXT MANAGEMENT
// ============================================================================

/**
 * Configuration for model-aware context optimization
 */
export interface ModelContextConfig {
  /** Maximum context window for the model (in tokens) */
  contextWindow: number
  /** Reserved tokens for output (will be calculated if not provided) */
  reservedOutputTokens?: number
  /** System prompt tokens (estimated if not provided) */
  systemPromptTokens?: number
}

/**
 * Optimize messages to fit within a specific model's context window
 *
 * This function AGGRESSIVELY truncates to ensure the total payload fits.
 * Strategy:
 * 1. Estimate system prompt + output token needs
 * 2. Calculate available tokens for conversation
 * 3. Keep most recent messages that fit
 * 4. Truncate remaining messages if needed
 *
 * @param messages - Full message history
 * @param config - Model context configuration
 * @returns Object with optimized messages and calculated max output tokens
 */
export function optimizeForContextWindow(
  messages: Message[],
  config: ModelContextConfig
): {
  messages: Message[]
  maxOutputTokens: number
  inputTokens: number
  availableForInput: number
} {
  const {
    contextWindow,
    reservedOutputTokens = 8000, // Default 8K output
    systemPromptTokens = 5000,   // Default 5K for system prompt
  } = config

  // Calculate available tokens for conversation
  // Leave 10% safety margin to account for tokenization differences
  const safetyMargin = Math.floor(contextWindow * 0.10)
  const availableForInput = contextWindow - reservedOutputTokens - systemPromptTokens - safetyMargin

  console.log(`[Context Optimizer] Context window: ${contextWindow}, Available for input: ${availableForInput}`)

  if (availableForInput <= 0) {
    console.error(`[Context Optimizer] No tokens available for input! contextWindow=${contextWindow}, reserved=${reservedOutputTokens}, system=${systemPromptTokens}`)
    // Return minimal messages with reduced output
    return {
      messages: messages.slice(-2), // Keep last 2 messages
      maxOutputTokens: Math.min(reservedOutputTokens, Math.floor(contextWindow * 0.3)),
      inputTokens: 0,
      availableForInput: 0,
    }
  }

  // First, apply standard optimization
  const optimized = optimizeMessagePayload(messages)

  // Estimate current token usage
  let totalTokens = estimateTotalTokens(optimized)

  console.log(`[Context Optimizer] Initial tokens: ${totalTokens}, Target: ${availableForInput}`)

  // If we're already under the limit, return as-is
  if (totalTokens <= availableForInput) {
    return {
      messages: optimized,
      maxOutputTokens: reservedOutputTokens,
      inputTokens: totalTokens,
      availableForInput,
    }
  }

  // Strategy: Remove older messages until we fit
  // Keep system messages and at least the last 2 user/assistant exchanges
  const systemMessages = optimized.filter(m => m.role === "system")
  let conversationMessages = optimized.filter(m => m.role !== "system")

  // Keep removing oldest messages until we fit
  while (conversationMessages.length > 2 && totalTokens > availableForInput) {
    const removed = conversationMessages.shift()
    if (removed) {
      const removedTokens = estimateMessageTokens(removed)
      totalTokens -= removedTokens
      console.log(`[Context Optimizer] Removed message (${removed.role}), freed ${removedTokens} tokens. New total: ${totalTokens}`)
    }
  }

  // If still over limit after removing messages, truncate the remaining content more aggressively
  if (totalTokens > availableForInput) {
    console.log(`[Context Optimizer] Still over limit after message removal. Applying aggressive truncation.`)

    // Calculate how much we need to cut
    const excessTokens = totalTokens - availableForInput
    const excessChars = excessTokens * 4 // Convert back to chars

    // Truncate each message proportionally
    conversationMessages = conversationMessages.map(msg => {
      const msgContent = getTextContent(msg as AppMessage)
      if (msgContent && msgContent.length > 1000) {
        const maxChars = Math.max(500, msgContent.length - Math.floor(excessChars / conversationMessages.length))
        const truncatedText = msgContent.substring(0, maxChars) + "\n\n[Content truncated to fit context window]"
        // Update the parts with truncated content
        const newParts = msg.parts ? msg.parts.map((part: any) => {
          if (part.type === "text") {
            return { ...part, text: truncatedText }
          }
          return part
        }) : [{ type: "text", text: truncatedText }]
        return {
          ...msg,
          parts: newParts,
          // Also update legacy content field if it exists
          ...((msg as AppMessage).content !== undefined ? { content: truncatedText } : {}),
        }
      }
      return msg
    })

    // Recalculate
    totalTokens = estimateTotalTokens([...systemMessages, ...conversationMessages])
    console.log(`[Context Optimizer] After aggressive truncation: ${totalTokens} tokens`)
  }

  // Final check - if still over, drastically reduce output tokens
  let finalOutputTokens = reservedOutputTokens
  if (totalTokens > availableForInput) {
    // We can't reduce input further, so reduce output tokens
    const remaining = contextWindow - systemPromptTokens - totalTokens - safetyMargin
    finalOutputTokens = Math.max(2000, Math.min(reservedOutputTokens, remaining))
    console.log(`[Context Optimizer] Reducing output tokens to ${finalOutputTokens}`)
  }

  const finalMessages = [...systemMessages, ...conversationMessages]

  console.log(`[Context Optimizer] Final: ${finalMessages.length} messages, ${totalTokens} input tokens, ${finalOutputTokens} max output tokens`)

  return {
    messages: finalMessages,
    maxOutputTokens: finalOutputTokens,
    inputTokens: totalTokens,
    availableForInput,
  }
}

// Note: Perplexity optimization function removed - now using Gemini 3 with 1M context window
// Gemini models don't require aggressive context optimization like Perplexity's 128K limit
