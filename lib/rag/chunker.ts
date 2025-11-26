/**
 * Text Chunking Module
 * Implements sliding window chunking with overlap for optimal retrieval
 */

import { encode, decode } from "gpt-tokenizer"
import type { TextChunk } from "./types"
import {
  RAG_CHUNK_SIZE,
  RAG_CHUNK_OVERLAP,
  RAG_MAX_CHUNK_SIZE,
} from "./config"

/**
 * Estimate page number for a character position in the full text
 * Uses simple heuristic: ~400 words per page, ~5 chars per word
 */
function estimatePageNumber(
  charPosition: number,
  totalChars: number,
  totalPages: number
): number {
  if (totalPages === 0) return 1

  const ratio = charPosition / totalChars
  const estimatedPage = Math.ceil(ratio * totalPages)

  return Math.max(1, Math.min(estimatedPage, totalPages))
}

/**
 * Split text into chunks using sliding window approach with token overlap
 *
 * @param text - Full text to chunk
 * @param pageCount - Total number of pages (for page number estimation)
 * @param chunkSize - Target tokens per chunk (default: RAG_CHUNK_SIZE)
 * @param overlapSize - Token overlap between chunks (default: RAG_CHUNK_OVERLAP)
 * @returns Array of text chunks with metadata
 */
export function chunkText(
  text: string,
  pageCount: number = 0,
  chunkSize: number = RAG_CHUNK_SIZE,
  overlapSize: number = RAG_CHUNK_OVERLAP
): TextChunk[] {
  // Validate inputs
  if (!text || text.trim().length === 0) {
    return []
  }

  if (chunkSize <= 0 || chunkSize > RAG_MAX_CHUNK_SIZE) {
    throw new Error(
      `Invalid chunk size: ${chunkSize}. Must be between 1 and ${RAG_MAX_CHUNK_SIZE}`
    )
  }

  if (overlapSize < 0 || overlapSize >= chunkSize) {
    throw new Error(
      `Invalid overlap size: ${overlapSize}. Must be between 0 and ${chunkSize}`
    )
  }

  try {
    // Encode full text to tokens
    const tokens = encode(text)
    const chunks: TextChunk[] = []
    const totalChars = text.length

    let chunkIndex = 0
    let position = 0

    while (position < tokens.length) {
      // Extract chunk tokens
      const chunkTokens = tokens.slice(position, position + chunkSize)

      // Decode back to text
      const chunkText = decode(chunkTokens)

      // Estimate page number based on character position
      // Find approximate character position of this chunk
      const charPosition = Math.floor((position / tokens.length) * totalChars)
      const pageNumber =
        pageCount > 0
          ? estimatePageNumber(charPosition, totalChars, pageCount)
          : null

      // Create chunk object
      chunks.push({
        content: chunkText.trim(),
        pageNumber,
        chunkIndex,
        tokenCount: chunkTokens.length,
      })

      // Move to next chunk position with overlap
      position += chunkSize - overlapSize
      chunkIndex++
    }

    return chunks
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Text chunking failed: ${error.message}`)
    }
    throw new Error("Text chunking failed: Unknown error")
  }
}

/**
 * Merge overlapping chunks back into continuous text
 * Useful for debugging or testing
 *
 * @param chunks - Array of text chunks
 * @returns Merged text
 */
export function mergeChunks(chunks: TextChunk[]): string {
  return chunks.map((chunk) => chunk.content).join("\n\n")
}

/**
 * Calculate total tokens across all chunks
 *
 * @param chunks - Array of text chunks
 * @returns Total token count
 */
export function getTotalTokens(chunks: TextChunk[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)
}

/**
 * Get statistics about chunking results
 *
 * @param chunks - Array of text chunks
 * @returns Chunking statistics
 */
export function getChunkingStats(chunks: TextChunk[]): {
  totalChunks: number
  totalTokens: number
  avgTokensPerChunk: number
  minTokens: number
  maxTokens: number
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
    }
  }

  const tokenCounts = chunks.map((c) => c.tokenCount)
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0)

  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
  }
}

/**
 * Split text by paragraphs and then chunk each paragraph
 * Helps maintain semantic boundaries
 *
 * @param text - Full text to chunk
 * @param pageCount - Total pages for estimation
 * @returns Array of text chunks
 */
export function chunkByParagraphs(
  text: string,
  pageCount: number = 0
): TextChunk[] {
  // Split by double newlines (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)

  const allChunks: TextChunk[] = []
  let globalChunkIndex = 0

  for (const paragraph of paragraphs) {
    const paragraphChunks = chunkText(paragraph, pageCount)

    // Re-index chunks globally
    for (const chunk of paragraphChunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
      })
    }
  }

  return allChunks
}
