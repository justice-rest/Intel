/**
 * AI SDK v6 Compatibility Layer
 *
 * This module provides type definitions and utilities for maintaining
 * backwards compatibility with code written for AI SDK v4.
 *
 * In AI SDK v6:
 * - UIMessage uses `parts` array instead of `content` string
 * - Message parts have different structures (toolInvocation → toolCallId, toolName, etc.)
 * - streamText returns different response methods (toUIMessageStreamResponse instead of toDataStreamResponse)
 *
 * This compatibility layer allows existing code to work while we incrementally
 * migrate to the new structure.
 */

import type { Attachment } from "@/app/types/database.types"

/**
 * Legacy message format used by frontend and existing code
 * This matches the AI SDK v4 Message type structure
 */
export interface LegacyMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string | null | ContentPart[]
  toolInvocations?: ToolInvocation[]
  experimental_attachments?: Attachment[]
  createdAt?: Date
  parts?: ContentPart[]
}

/**
 * Content part for message content arrays
 */
export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: unknown
  result?: unknown
  reasoning?: string
}

/**
 * Tool invocation structure
 */
export interface ToolInvocation {
  toolCallId: string
  toolName: string
  state: "call" | "partial-call" | "result"
  args?: unknown
  result?: unknown
}

/**
 * Tool invocation UI part for rendering
 */
export interface ToolInvocationUIPart {
  type: "tool-invocation"
  toolInvocation: ToolInvocation
}

/**
 * Source part for rendering
 */
export interface Source {
  id: string
  url: string
  title?: string
}

/**
 * Extract text content from a message
 * Handles both legacy `content` string and v6 `parts` array
 */
export function getMessageContent(message: LegacyMessage): string {
  // If content is a string, return it directly
  if (typeof message.content === "string") {
    return message.content
  }

  // If content is an array, extract text from parts
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join("\n")
  }

  // Try parts array (v6 structure)
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join("\n")
  }

  return ""
}

/**
 * Check if a message has tool invocations
 */
export function hasToolInvocations(message: LegacyMessage): boolean {
  // Check toolInvocations array
  if (message.toolInvocations && message.toolInvocations.length > 0) {
    return true
  }

  // Check content array for tool parts
  if (Array.isArray(message.content)) {
    return message.content.some(
      (part) =>
        part.type === "tool-call" ||
        part.type === "tool-result" ||
        part.type === "tool-invocation"
    )
  }

  // Check parts array (v6 structure)
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts.some(
      (part) =>
        part.type?.startsWith("tool-") ||
        part.type === "dynamic-tool"
    )
  }

  return false
}

/**
 * Get tool invocations from a message
 * Handles both legacy toolInvocations array and v6 parts
 */
export function getToolInvocations(message: LegacyMessage): ToolInvocation[] {
  // Return legacy toolInvocations if present
  if (message.toolInvocations) {
    return message.toolInvocations
  }

  // Extract from parts array
  const invocations: ToolInvocation[] = []

  const parts = message.parts || (Array.isArray(message.content) ? message.content : [])

  for (const part of parts) {
    if (part.toolCallId && part.toolName) {
      invocations.push({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        state: (part as any).state || "result",
        args: part.args,
        result: part.result,
      })
    }
  }

  return invocations
}
