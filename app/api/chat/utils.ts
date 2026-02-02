import type { UIMessage, UIMessagePart } from "ai"
import { isTextUIPart, isToolUIPart, isFileUIPart } from "ai"

/**
 * Helper to extract text content from UIMessage parts (v5 uses parts array, not content string)
 */
export function getMessageTextContent(message: UIMessage): string {
  if (!message.parts) return ""
  return message.parts
    .filter(isTextUIPart)
    .map(part => part.text)
    .join("\n")
}

/**
 * Helper to check if UIMessage parts are empty (v5)
 */
function isEmptyParts(parts: UIMessagePart<any, any>[] | undefined): boolean {
  if (!parts || parts.length === 0) return true

  // Check if any part has meaningful content
  for (const part of parts) {
    if (isTextUIPart(part) && part.text?.trim()) {
      return false
    }
    // Non-text parts (tool invocations, files, etc.) count as content
    if (part.type !== "text") {
      return false
    }
  }
  return true
}

/**
 * Clean messages for models based on their capabilities.
 * - Removes tool invocations when model doesn't support tools
 * - Removes file parts when model doesn't support vision/files
 * This prevents "Bad Request" errors when using models like Perplexity.
 *
 * NOTE: In AI SDK v5, UIMessage uses `parts` array, not `content` string.
 */
export function cleanMessagesForTools(
  messages: UIMessage[],
  hasTools: boolean,
  hasVision: boolean = true // Default to true for backwards compatibility
): UIMessage[] {
  // Always sanitize messages to ensure no empty content (xAI/Grok requires non-empty)
  const sanitizedMessages = messages.map((message) => {
    if (isEmptyParts(message.parts)) {
      // Add a placeholder text part
      return {
        ...message,
        parts: [{ type: "text" as const, text: message.role === "assistant" ? "[Assistant response]" : "[User message]" }],
      }
    }
    return message
  })

  // If model supports everything, return sanitized messages
  if (hasTools && hasVision) {
    return sanitizedMessages
  }

  // Clean messages based on model capabilities
  const cleanedMessages = sanitizedMessages
    .map((message) => {
      // Skip tool role messages entirely when no tools are available
      // Note: In v5, tool results are in parts, not separate role
      if (!hasTools && (message as any).role === "tool") {
        return null
      }

      // Filter parts based on model capabilities
      const filteredParts = message.parts?.filter((part) => {
        // Remove tool parts if model doesn't support tools
        if (!hasTools) {
          if (isToolUIPart(part)) return false
          // Also remove dynamic tool parts
          if ((part as any).type === "tool-invocation" || (part as any).type === "tool-result") {
            return false
          }
        }

        // Remove file parts if model doesn't support vision
        if (!hasVision) {
          if (isFileUIPart(part)) return false
          // Also remove image type parts for backward compatibility
          if ((part as any).type === "image" || (part as any).type === "image_url") {
            return false
          }
        }

        return true
      }) || []

      // If all parts were filtered out, add a placeholder
      const finalParts = filteredParts.length > 0
        ? filteredParts
        : [{ type: "text" as const, text: message.role === "assistant" ? "[Assistant response]" : "[User message]" }]

      return {
        ...message,
        parts: finalParts,
      }
    })
    .filter((message): message is UIMessage => message !== null)

  return cleanedMessages
}

/**
 * Check if a message contains tool-related content (v5: check parts array)
 */
export function messageHasToolContent(message: UIMessage): boolean {
  if (!message.parts) return false

  return message.parts.some((part) => {
    if (isToolUIPart(part)) return true
    const partType = (part as any).type
    return partType === "tool-invocation" || partType === "tool-result" || partType === "tool-call"
  })
}

/**
 * Structured error type for API responses
 */
export type ApiError = Error & {
  statusCode: number
  code: string
}

/**
 * Parse and handle stream errors from AI SDK
 * @deprecated Use extractErrorMessage instead for streaming errors with toDataStreamResponse
 * This is kept for legacy/fallback purposes or non-streaming error scenarios
 * @param err - The error from streamText onError callback
 * @returns Structured error with status code and error code
 */
export function handleStreamError(err: unknown): ApiError {
  console.error("🛑 streamText error:", err)

  // Extract error details from the AI SDK error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiError = (err as { error?: any })?.error

  if (aiError) {
    // Try to extract detailed error message from response body
    let detailedMessage = ""
    if (aiError.responseBody) {
      try {
        const parsed = JSON.parse(aiError.responseBody)
        if (parsed.error?.message) {
          detailedMessage = parsed.error.message
        } else if (parsed.message) {
          detailedMessage = parsed.message
        }
      } catch {
        // JSON parse failed, use raw body
        detailedMessage = String(aiError.responseBody).substring(0, 200)
      }
    }

    // Check for specific error types
    if (aiError.statusCode === 429) {
      const error = new Error(
        detailedMessage || "Rate limit exceeded. Please wait a moment and try again."
      ) as ApiError
      error.statusCode = 429
      error.code = "RATE_LIMIT_EXCEEDED"
      return error
    }

    if (aiError.statusCode === 400) {
      const error = new Error(
        detailedMessage || "Bad request. The model may not support certain features."
      ) as ApiError
      error.statusCode = 400
      error.code = "BAD_REQUEST"
      return error
    }

    if (aiError.statusCode === 401 || aiError.statusCode === 403) {
      const error = new Error(
        detailedMessage || "Authentication failed. Please check your API key."
      ) as ApiError
      error.statusCode = aiError.statusCode
      error.code = "AUTH_ERROR"
      return error
    }

    // Generic AI error with status code
    const error = new Error(
      detailedMessage || aiError.message || "AI model request failed"
    ) as ApiError
    error.statusCode = aiError.statusCode || 500
    error.code = "AI_ERROR"
    return error
  }

  // Unknown error type
  const error = new Error(
    err instanceof Error ? err.message : "Unknown streaming error"
  ) as ApiError
  error.statusCode = 500
  error.code = "STREAM_ERROR"
  return error
}

/**
 * Extract error message from AI SDK stream errors
 * Works with the newer toDataStreamResponse error format
 * @param err - The error from streamText
 * @returns Human-readable error message
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return "Unknown error"

  // Handle Error objects
  if (err instanceof Error) {
    // Check for nested error details
    const anyErr = err as any
    if (anyErr.cause?.message) {
      return anyErr.cause.message
    }
    return err.message
  }

  // Handle API error response format
  if (typeof err === "object") {
    const anyErr = err as any

    // Check for responseBody (JSON string from API)
    if (anyErr.responseBody) {
      try {
        const parsed = JSON.parse(anyErr.responseBody)
        if (parsed.error?.message) return parsed.error.message
        if (parsed.message) return parsed.message
      } catch {
        // Not JSON, use as-is
        return String(anyErr.responseBody).substring(0, 200)
      }
    }

    // Check for nested error object
    if (anyErr.error?.message) {
      return anyErr.error.message
    }

    // Check for direct message
    if (anyErr.message) {
      return anyErr.message
    }
  }

  // Fallback to string conversion
  return String(err)
}

/**
 * Create a standardized error response for the API
 * @param message - Error message to return
 * @param statusCode - HTTP status code
 * @returns Response object with JSON error body
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  })
}
