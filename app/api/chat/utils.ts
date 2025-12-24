import { Message as MessageAISDK } from "ai"

/**
 * Clean messages for models based on their capabilities.
 * - Removes tool invocations when model doesn't support tools
 * - Removes attachments when model doesn't support vision/files
 * This prevents "Bad Request" errors when using models like Perplexity.
 */
export function cleanMessagesForTools(
  messages: MessageAISDK[],
  hasTools: boolean,
  hasVision: boolean = true // Default to true for backwards compatibility
): MessageAISDK[] {
  // Helper to check if content is empty/invalid
  const isEmptyContent = (content: unknown): boolean => {
    if (content === null || content === undefined) return true
    if (typeof content === "string") return content.trim() === ""
    if (Array.isArray(content)) return content.length === 0
    return false
  }

  // Always sanitize messages to ensure no empty content (xAI/Grok requires non-empty)
  const sanitizedMessages = messages.map((message) => {
    if (isEmptyContent(message.content)) {
      return {
        ...message,
        content: message.role === "assistant" ? "[Assistant response]" : "[User message]",
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
      // Skip tool messages entirely when no tools are available
      if (!hasTools && (message as { role: string }).role === "tool") {
        return null
      }

      // Start with a copy of the message
      let cleanedMessage: MessageAISDK = { ...message }

      // Remove attachments for non-vision models (like Perplexity which only supports text)
      if (!hasVision && (cleanedMessage as any).experimental_attachments) {
        delete (cleanedMessage as any).experimental_attachments
      }

      if (message.role === "assistant") {
        // Clean tool invocations if model doesn't support tools
        if (!hasTools && message.toolInvocations && message.toolInvocations.length > 0) {
          delete cleanedMessage.toolInvocations
        }

        if (Array.isArray(message.content)) {
          const filteredContent = (
            message.content as Array<{ type?: string; text?: string }>
          ).filter((part: { type?: string }) => {
            if (part && typeof part === "object" && part.type) {
              // Remove tool-related parts if model doesn't support tools
              if (!hasTools) {
                const isToolPart =
                  part.type === "tool-call" ||
                  part.type === "tool-result" ||
                  part.type === "tool-invocation"
                if (isToolPart) return false
              }
              // Remove image parts if model doesn't support vision
              if (!hasVision) {
                const isImagePart =
                  part.type === "image" ||
                  part.type === "image_url" ||
                  part.type === "file"
                if (isImagePart) return false
              }
            }
            return true
          })

          // Extract text content
          const textParts = filteredContent.filter(
            (part: { type?: string }) =>
              part && typeof part === "object" && part.type === "text"
          )

          if (textParts.length > 0) {
            // Combine text parts into a single string
            const textContent = textParts
              .map((part: { text?: string }) => part.text || "")
              .join("\n")
              .trim()
            cleanedMessage.content = textContent || "[Assistant response]"
          } else if (filteredContent.length === 0) {
            // If no content remains after filtering, provide fallback
            cleanedMessage.content = "[Assistant response]"
          } else {
            // Keep the filtered content as string if possible
            cleanedMessage.content = "[Assistant response]"
          }
        }

        // If the message has no meaningful content after cleaning, provide fallback
        if (
          !cleanedMessage.content ||
          (typeof cleanedMessage.content === "string" &&
            cleanedMessage.content.trim() === "")
        ) {
          cleanedMessage.content = "[Assistant response]"
        }

        return cleanedMessage
      }

      // For user messages, clean content based on model capabilities
      if (message.role === "user" && Array.isArray(message.content)) {
        const filteredContent = (
          message.content as Array<{ type?: string }>
        ).filter((part: { type?: string }) => {
          if (part && typeof part === "object" && part.type) {
            // Remove tool-related parts if model doesn't support tools
            if (!hasTools) {
              const isToolPart =
                part.type === "tool-call" ||
                part.type === "tool-result" ||
                part.type === "tool-invocation"
              if (isToolPart) return false
            }
            // Remove image parts if model doesn't support vision
            if (!hasVision) {
              const isImagePart =
                part.type === "image" ||
                part.type === "image_url" ||
                part.type === "file"
              if (isImagePart) return false
            }
          }
          return true
        })

        if (
          filteredContent.length !== (message.content as Array<unknown>).length
        ) {
          return {
            ...cleanedMessage,
            content:
              filteredContent.length > 0 ? filteredContent : "User message",
          }
        }
      }

      return cleanedMessage
    })
    .filter((message): message is MessageAISDK => message !== null)

  return cleanedMessages
}

/**
 * Check if a message contains tool-related content
 */
export function messageHasToolContent(message: MessageAISDK): boolean {
  return !!(
    message.toolInvocations?.length ||
    (message as { role: string }).role === "tool" ||
    (Array.isArray(message.content) &&
      (message.content as Array<{ type?: string }>).some(
        (part: { type?: string }) =>
          part &&
          typeof part === "object" &&
          part.type &&
          (part.type === "tool-call" ||
            part.type === "tool-result" ||
            part.type === "tool-invocation")
      ))
  )
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
        // Handle different error response formats
        if (parsed.error?.message) {
          detailedMessage = parsed.error.message
        } else if (parsed.error && typeof parsed.error === "string") {
          detailedMessage = parsed.error
        } else if (parsed.message) {
          detailedMessage = parsed.message
        }
      } catch {
        // Fallback to generic message if parsing fails
      }
    }

    // Handle specific API errors with proper status codes
    if (aiError.statusCode === 402) {
      // Payment required
      const message =
        detailedMessage || "Insufficient credits or payment required"
      return Object.assign(new Error(message), {
        statusCode: 402,
        code: "PAYMENT_REQUIRED",
      })
    } else if (aiError.statusCode === 401) {
      // Authentication error - use detailed message if available
      const message =
        detailedMessage ||
        "Invalid API key or authentication failed. Please check your API key in settings."
      return Object.assign(new Error(message), {
        statusCode: 401,
        code: "AUTHENTICATION_ERROR",
      })
    } else if (aiError.statusCode === 429) {
      // Rate limit - use friendly message
      const message =
        detailedMessage || "We're experiencing high demand right now! Our systems are a bit overloaded. Please wait a moment and try again. Sorry for the inconvenience!"
      return Object.assign(new Error(message), {
        statusCode: 429,
        code: "RATE_LIMIT_EXCEEDED",
      })
    } else if (aiError.statusCode >= 400 && aiError.statusCode < 500) {
      // Other client errors
      const message = detailedMessage || aiError.message || "Request failed"
      return Object.assign(new Error(message), {
        statusCode: aiError.statusCode,
        code: "CLIENT_ERROR",
      })
    } else {
      // Server errors or other issues
      const message = detailedMessage || aiError.message || "AI service error"
      return Object.assign(new Error(message), {
        statusCode: aiError.statusCode || 500,
        code: "SERVER_ERROR",
      })
    }
  } else {
    // Fallback for unknown error format
    return Object.assign(
      new Error("AI generation failed. Please check your model or API key."),
      {
        statusCode: 500,
        code: "UNKNOWN_ERROR",
      }
    )
  }
}

/**
 * Extract a user-friendly error message from various error types
 * Used for streaming errors that need to be forwarded to the client
 * @param error - The error from AI SDK or other sources
 * @returns User-friendly error message string
 */
export function extractErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (error == null) {
    return "An unknown error occurred."
  }

  // Handle string errors
  if (typeof error === "string") {
    return error
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Check for specific error patterns
    if (
      error.message.includes("invalid x-api-key") ||
      error.message.includes("authentication_error")
    ) {
      return "Invalid API key or authentication failed. Please check your API key in settings."
    } else if (
      error.message.includes("402") ||
      error.message.includes("payment") ||
      error.message.includes("credits")
    ) {
      return "Insufficient credits or payment required."
    } else if (
      error.message.includes("429") ||
      error.message.includes("rate limit")
    ) {
      return "We're experiencing high demand right now! Our systems are a bit overloaded. Please wait a moment and try again. Sorry for the inconvenience!"
    }

    return error.message
  }

  // Handle AI SDK error objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiError = (error as any)?.error
  if (aiError) {
    if (aiError.statusCode === 401) {
      return "Invalid API key or authentication failed. Please check your API key in settings."
    } else if (aiError.statusCode === 402) {
      return "Insufficient credits or payment required."
    } else if (aiError.statusCode === 429) {
      return "We're experiencing high demand right now! Our systems are a bit overloaded. Please wait a moment and try again. Sorry for the inconvenience!"
    } else if (aiError.responseBody) {
      try {
        const parsed = JSON.parse(aiError.responseBody)
        if (parsed.error?.message) {
          return parsed.error.message
        }
      } catch {
        // Fall through to generic message
      }
    }

    return aiError.message || "Request failed"
  }

  return "An error occurred. Please try again."
}

/**
 * Create error response for API endpoints
 * @param error - Error object with optional statusCode and code
 * @returns Response object with proper status and JSON body
 */
export function createErrorResponse(error: {
  code?: string
  message?: string
  statusCode?: number
}): Response {
  // Handle subscription required
  if (error.code === "SUBSCRIPTION_REQUIRED") {
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: 403 }
    )
  }

  // Handle pro limit reached
  if (error.code === "PRO_LIMIT_REACHED") {
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: 429 }
    )
  }

  // Handle daily limit first (existing logic)
  if (error.code === "DAILY_LIMIT_REACHED") {
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: 403 }
    )
  }

  // Handle stream errors with proper status codes
  if (error.statusCode) {
    return new Response(
      JSON.stringify({
        error: error.message || "Request failed",
        code: error.code || "REQUEST_ERROR",
      }),
      { status: error.statusCode }
    )
  }

  // Fallback for other errors
  return new Response(
    JSON.stringify({ error: error.message || "Internal server error" }),
    { status: 500 }
  )
}
