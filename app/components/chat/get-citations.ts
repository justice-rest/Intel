/**
 * Extract RAG citations from message parts
 * Similar to get-sources.ts but for RAG tool results
 *
 * AI SDK v6 format: Tools have type `tool-${toolName}` with direct properties
 */

import type { UIMessage as MessageAISDK } from "@ai-sdk/react"

export interface Citation {
  document: string
  page: number | null
  content: string
  similarity: number
  documentId: string
  chunkId: string
}

// Type for tool UI part in v6 - tools have type `tool-${toolName}` and direct properties
interface ToolUIPart {
  type: string  // `tool-${toolName}`
  toolCallId: string
  state: "input-streaming" | "output-streaming" | "input-available" | "output-available" | "output-error"
  title?: string
  input?: unknown
  output?: unknown
  errorText?: string
  toolName?: string  // Added by us for convenience
}

// Helper to check if a part is a tool part
function isToolPart(part: any): part is ToolUIPart {
  return part && typeof part.type === "string" && part.type.startsWith("tool-")
}

// Helper to extract tool name from type
function getToolName(part: ToolUIPart): string {
  // type is `tool-${toolName}`, so extract the tool name
  return part.toolName || part.type.replace("tool-", "")
}

// Helper to check if tool has result
function hasResult(part: ToolUIPart): boolean {
  return part.state === "output-available" && part.output !== undefined
}

export function getCitations(parts: MessageAISDK["parts"]): Citation[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const citations: Citation[] = []

  for (const part of parts) {
    // Look for tool parts with rag_search tool in v6 format
    if (isToolPart(part) && hasResult(part) && getToolName(part) === "rag_search") {
      try {
        // In v6, the result is stored directly in part.output
        const result = part.output as any

        if (result?.success && Array.isArray(result?.results)) {
          for (const item of result.results) {
            citations.push({
              document: item.document || "Unknown Document",
              page: item.page || null,
              content: item.content || "",
              similarity: item.similarity || 0,
              documentId: item.documentId || "",
              chunkId: item.chunkId || "",
            })
          }
        }
      } catch (error) {
        console.error("Error parsing RAG citations:", error)
      }
    }
  }

  return citations
}
