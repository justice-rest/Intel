/**
 * Embeddings Generation Module
 * Generates vector embeddings using Google Gemini or OpenAI via OpenRouter
 */

import type { EmbeddingRequest, EmbeddingResponse } from "./types"
import {
  RAG_EMBEDDING_MODEL,
  RAG_EMBEDDING_MODEL_FALLBACK,
  RAG_EMBEDDING_MAX_RETRIES,
  RAG_EMBEDDING_RETRY_DELAY,
  RAG_EMBEDDING_DIMENSIONS,
  OPENROUTER_API_URL,
} from "./config"

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sanitize text for embedding API
 * Removes or replaces characters that could cause encoding issues
 */
function sanitizeTextForEmbedding(text: string): string {
  if (!text) return ""

  // Normalize Unicode characters to their composed form (NFC)
  // This ensures consistent encoding across platforms
  let sanitized = text.normalize("NFC")

  // Replace problematic characters that might cause ByteString issues
  // These are characters outside the Basic Multilingual Plane or control characters
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ") // Control characters

  // Replace any remaining problematic high Unicode characters
  // Keep common extended characters like accented letters, but remove rare ones
  sanitized = sanitized.replace(/[\uD800-\uDFFF]/g, "") // Remove surrogate pairs that aren't matched

  // Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, " ").trim()

  return sanitized
}

/**
 * Truncate embedding vector to specified dimensions
 * Gemini embeddings support Matryoshka truncation without quality loss
 */
function truncateEmbedding(
  embedding: number[],
  targetDimensions: number
): number[] {
  if (embedding.length <= targetDimensions) {
    return embedding
  }
  return embedding.slice(0, targetDimensions)
}

/**
 * Generate embedding for a single text using OpenRouter
 *
 * @param text - Text to embed
 * @param model - Embedding model to use (defaults to RAG_EMBEDDING_MODEL)
 * @param apiKey - OpenRouter API key
 * @returns Embedding vector and metadata
 */
export async function generateEmbedding(
  text: string,
  apiKey: string,
  model: string = RAG_EMBEDDING_MODEL
): Promise<EmbeddingResponse> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text")
  }

  if (!apiKey) {
    throw new Error("OpenRouter API key is required for embedding generation")
  }

  let lastError: Error | null = null

  // Sanitize text before sending to API
  const sanitizedText = sanitizeTextForEmbedding(text)

  if (!sanitizedText || sanitizedText.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text after sanitization")
  }

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < RAG_EMBEDDING_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_API_URL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000",
          "X-Title": "Romy RAG Embeddings", // ASCII-only (HTTP headers must be ASCII)
        },
        body: JSON.stringify({
          model,
          input: sanitizedText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      // Extract embedding from response
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error("Invalid embedding response format from OpenRouter")
      }

      // Truncate to target dimensions (for Gemini: 3072 → 1536)
      const fullEmbedding = data.data[0].embedding
      const truncatedEmbedding = truncateEmbedding(
        fullEmbedding,
        RAG_EMBEDDING_DIMENSIONS
      )

      return {
        embedding: truncatedEmbedding,
        model: data.model || model,
        usage: {
          total_tokens: data.usage?.total_tokens || 0,
        },
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a rate limit error (429)
      if (
        lastError.message.includes("429") ||
        lastError.message.includes("rate limit")
      ) {
        // Calculate exponential backoff delay
        const delay = RAG_EMBEDDING_RETRY_DELAY * Math.pow(2, attempt)
        console.warn(
          `Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${RAG_EMBEDDING_MAX_RETRIES})...`
        )
        await sleep(delay)
        continue
      }

      // For non-rate-limit errors, don't retry
      throw lastError
    }
  }

  // If we've exhausted all retries
  throw new Error(
    `Failed to generate embedding after ${RAG_EMBEDDING_MAX_RETRIES} attempts: ${lastError?.message}`
  )
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenRouter supports batch processing
 *
 * @param texts - Array of texts to embed
 * @param apiKey - OpenRouter API key
 * @param model - Embedding model to use
 * @returns Array of embeddings in the same order as input texts
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string,
  model: string = RAG_EMBEDDING_MODEL
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  if (!apiKey) {
    throw new Error("OpenRouter API key is required for embedding generation")
  }

  let lastError: Error | null = null

  // Sanitize all texts before sending to API
  // Don't filter - preserve array length to maintain index mapping
  const sanitizedTexts = texts.map((text) => {
    const sanitized = sanitizeTextForEmbedding(text)
    // If text becomes empty after sanitization, use a placeholder
    return sanitized.trim().length > 0 ? sanitized : "[empty content]"
  })

  if (sanitizedTexts.every((t) => t === "[empty content]")) {
    throw new Error("All texts are empty after sanitization")
  }

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < RAG_EMBEDDING_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_API_URL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000",
          "X-Title": "Romy RAG Embeddings", // ASCII-only (HTTP headers must be ASCII)
        },
        body: JSON.stringify({
          model,
          input: sanitizedTexts, // Send array for batch processing
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        )
      }

      const data = await response.json()

      // Extract embeddings from response
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid embedding response format from OpenRouter")
      }

      // Sort by index to ensure correct order
      const sortedData = data.data.sort(
        (a: any, b: any) => a.index - b.index
      )

      // Truncate embeddings to target dimensions
      const embeddings = sortedData.map((item: any) =>
        truncateEmbedding(item.embedding, RAG_EMBEDDING_DIMENSIONS)
      )

      if (embeddings.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`
        )
      }

      return embeddings
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a rate limit error (429)
      if (
        lastError.message.includes("429") ||
        lastError.message.includes("rate limit")
      ) {
        // Calculate exponential backoff delay
        const delay = RAG_EMBEDDING_RETRY_DELAY * Math.pow(2, attempt)
        console.warn(
          `Rate limit hit. Retrying in ${delay}ms (attempt ${attempt + 1}/${RAG_EMBEDDING_MAX_RETRIES})...`
        )
        await sleep(delay)
        continue
      }

      // For non-rate-limit errors, don't retry
      throw lastError
    }
  }

  // If we've exhausted all retries
  throw new Error(
    `Failed to generate embeddings after ${RAG_EMBEDDING_MAX_RETRIES} attempts: ${lastError?.message}`
  )
}

/**
 * Generate embedding with automatic fallback to alternative model
 *
 * @param text - Text to embed
 * @param apiKey - OpenRouter API key
 * @returns Embedding vector and metadata
 */
export async function generateEmbeddingWithFallback(
  text: string,
  apiKey: string
): Promise<EmbeddingResponse> {
  try {
    // Try primary model first (Gemini)
    return await generateEmbedding(text, apiKey, RAG_EMBEDDING_MODEL)
  } catch (error) {
    console.warn(
      `Primary embedding model (${RAG_EMBEDDING_MODEL}) failed. Falling back to ${RAG_EMBEDDING_MODEL_FALLBACK}...`
    )

    // Fallback to OpenAI model
    return await generateEmbedding(text, apiKey, RAG_EMBEDDING_MODEL_FALLBACK)
  }
}

/**
 * Batch generate embeddings with chunking
 * Splits large batches into smaller chunks to avoid API limits
 *
 * @param texts - Array of texts to embed
 * @param apiKey - OpenRouter API key
 * @param batchSize - Number of texts per batch (default: 100)
 * @returns Array of embeddings
 */
export async function generateEmbeddingsInBatches(
  texts: string[],
  apiKey: string,
  batchSize: number = 100
): Promise<number[][]> {
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    console.log(
      `Generating embeddings for batch ${i / batchSize + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)...`
    )

    const batchEmbeddings = await generateEmbeddings(batch, apiKey)
    allEmbeddings.push(...batchEmbeddings)
  }

  return allEmbeddings
}
