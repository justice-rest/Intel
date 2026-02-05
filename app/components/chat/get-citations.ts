/**
 * Extract RAG citations from message parts
 * Similar to get-sources.ts but for RAG tool results
 */

import type { ChatMessagePart } from "@/lib/ai/message-utils"
import { getLegacyToolInvocationParts } from "@/lib/ai/message-utils"

export interface Citation {
  document: string
  page: number | null
  content: string
  similarity: number
  documentId: string
  chunkId: string
}

type RagSearchResultItem = {
  document?: string
  page?: number | null
  content?: string
  similarity?: number
  documentId?: string
  chunkId?: string
}

type RagSearchResult = {
  success?: boolean
  results?: RagSearchResultItem[]
}

export function getCitations(parts: ChatMessagePart[] | undefined): Citation[] {
  if (!parts || parts.length === 0) {
    return []
  }

  const citations: Citation[] = []

  for (const part of getLegacyToolInvocationParts(parts)) {
    // Look for tool invocation parts with rag_search tool
    if (
      part.toolInvocation.state === "result" &&
      part.toolInvocation.toolName === "rag_search"
    ) {
      try {
        // The result is stored in the tool invocation result
        const result = part.toolInvocation.result as RagSearchResult

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
