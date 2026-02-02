/**
 * Extract RAG citations from message parts
 * Similar to get-sources.ts but for RAG tool results
 *
 * AI SDK v5 Migration Note:
 * - v4: parts have type: "tool-invocation" with toolInvocation.toolName
 * - v5: parts have type: "tool-{toolName}" with toolCallId, state, input/output directly
 */

import type { UIMessage as MessageAISDK } from "ai"

export interface Citation {
  document: string
  page: number | null
  content: string
  similarity: number
  documentId: string
  chunkId: string
}

// Helper to check if a part is a RAG search tool (v4 or v5 format)
function isRagSearchTool(part: any): boolean {
  // v5 format: type is "tool-rag_search"
  if (part.type === "tool-rag_search") {
    return true
  }
  // v4 format (backward compatibility): type is "tool-invocation"
  if (part.type === "tool-invocation" && part.toolInvocation?.toolName === "rag_search") {
    return true
  }
  return false
}

// Helper to get tool result from either v4 or v5 format
function getToolResult(part: any): any {
  // v5 format: output is directly on the part
  if (part.output !== undefined) {
    return part.output
  }
  // v4 format: result is in toolInvocation.result
  if (part.toolInvocation?.result !== undefined) {
    return part.toolInvocation.result
  }
  return null
}

// Helper to check if tool has completed (v4 or v5)
function isToolComplete(part: any): boolean {
  // v5 format: state is on the part directly
  if (part.state === "result" || part.state === "completed") {
    return true
  }
  // v4 format: state is in toolInvocation
  if (part.toolInvocation?.state === "result") {
    return true
  }
  return false
}

export function getCitations(parts: MessageAISDK["parts"]): Citation[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const citations: Citation[] = []

  for (const part of parts) {
    // Look for tool parts with rag_search tool (v4 or v5 format)
    if (isRagSearchTool(part) && isToolComplete(part)) {
      try {
        // Get the result from either format
        const result = getToolResult(part)

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
