import { tool } from "ai"
import { z } from "zod"
import {
  getJinaApiKey,
  isJinaEnabled,
  JINA_API_URL,
  JINA_DEFAULTS,
  type JinaReasoningEffort,
} from "../jina/config"

/**
 * Schema for Jina DeepSearch parameters
 */
export const jinaSearchParametersSchema = z.object({
  query: z.string().describe("The research query - complex questions work best"),
  reasoningEffort: z
    .enum(["low", "medium", "high"])
    .optional()
    .default("low")
    .describe(
      "Depth of research: 'low' (default) for quick answers (~20s), 'medium' for balanced (~57s), 'high' for thorough research (~120s)"
    ),
})

export type JinaSearchParameters = z.infer<typeof jinaSearchParametersSchema>

/**
 * Citation/source from Jina DeepSearch
 */
export interface JinaSource {
  title: string
  url: string
  snippet?: string
}

/**
 * Response from Jina DeepSearch tool
 */
export interface JinaSearchResponse {
  answer: string
  sources: JinaSource[]
  query: string
  reasoningEffort: JinaReasoningEffort
  visitedUrls?: string[]
  readUrls?: string[]
  tokenUsage?: {
    prompt: number
    completion: number
  }
}

// 120 second timeout - DeepSearch can take 60-120+ seconds for thorough research
const JINA_TIMEOUT_MS = 120000

/**
 * Parse Server-Sent Events stream from Jina DeepSearch
 * Returns the accumulated answer, annotations, and metadata
 */
async function parseJinaStream(
  response: Response
): Promise<{
  answer: string
  annotations: Array<{
    type: string
    url_citation?: { url: string; title?: string }
  }>
  visitedURLs: string[]
  readURLs: string[]
  usage: { prompt_tokens: number; completion_tokens: number }
}> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("No response body")
  }

  const decoder = new TextDecoder()
  let answer = ""
  let annotations: Array<{
    type: string
    url_citation?: { url: string; title?: string }
  }> = []
  let visitedURLs: string[] = []
  let readURLs: string[] = []
  let usage = { prompt_tokens: 0, completion_tokens: 0 }
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split("\n")
      buffer = lines.pop() || "" // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta

          if (delta?.content) {
            answer += delta.content
          }

          // Collect annotations (citations)
          if (delta?.annotations && Array.isArray(delta.annotations)) {
            annotations = annotations.concat(delta.annotations)
          }

          // Check for final metadata in the last chunk
          if (parsed.visitedURLs) {
            visitedURLs = parsed.visitedURLs
          }
          if (parsed.readURLs) {
            readURLs = parsed.readURLs
          }
          if (parsed.usage) {
            usage = {
              prompt_tokens: parsed.usage.prompt_tokens || 0,
              completion_tokens: parsed.usage.completion_tokens || 0,
            }
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { answer, annotations, visitedURLs, readURLs, usage }
}

/**
 * Jina DeepSearch Tool
 * Autonomous research agent that iteratively searches, reads, and reasons
 * about web content to answer complex queries.
 *
 * Features:
 * - Multi-step web research with reasoning
 * - Automatic source citation
 * - Configurable depth (low/medium/high)
 * - OpenAI-compatible streaming API
 * - Best for complex research questions
 */
export const jinaSearchTool = tool({
  description:
    "Deep research tool for complex questions requiring multi-step web research. " +
    "Uses AI to iteratively search, read, and reason about web content. " +
    "Best for: in-depth research, complex questions, fact-checking, competitive analysis, " +
    "and queries that require synthesizing information from multiple sources. " +
    "Takes longer (20-120s) but provides thorough, well-researched answers with citations. " +
    "Use 'low' effort for quick lookups, 'medium' (default) for balanced research, " +
    "'high' for exhaustive research on complex topics.",
  parameters: jinaSearchParametersSchema,
  execute: async ({
    query,
    reasoningEffort = JINA_DEFAULTS.reasoningEffort,
  }: JinaSearchParameters): Promise<JinaSearchResponse> => {
    console.log("[Jina Tool] Starting DeepSearch:", { query, reasoningEffort })
    const startTime = Date.now()

    // Check if Jina is enabled
    if (!isJinaEnabled()) {
      console.error("[Jina Tool] JINA_API_KEY not configured")
      return {
        answer:
          "Jina DeepSearch is not configured. Please add JINA_API_KEY to your environment variables.",
        sources: [],
        query,
        reasoningEffort,
      }
    }

    try {
      const apiKey = getJinaApiKey()

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS)

      // Make streaming request to Jina DeepSearch
      const response = await fetch(JINA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: JINA_DEFAULTS.model,
          messages: [{ role: "user", content: query }],
          stream: true,
          reasoning_effort: reasoningEffort,
          max_returned_urls: JINA_DEFAULTS.maxReturnedUrls,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Jina API error: ${response.status} - ${errorText}`)
      }

      // Parse the streaming response
      const { answer, annotations, visitedURLs, readURLs, usage } =
        await parseJinaStream(response)

      // Extract sources from annotations
      const sources: JinaSource[] = []
      const seenUrls = new Set<string>()

      for (const annotation of annotations) {
        if (
          annotation.type === "url_citation" &&
          annotation.url_citation?.url
        ) {
          const url = annotation.url_citation.url
          if (!seenUrls.has(url)) {
            seenUrls.add(url)
            sources.push({
              title: annotation.url_citation.title || extractDomain(url),
              url,
            })
          }
        }
      }

      // Also add visited URLs as sources if not already included
      for (const url of readURLs) {
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          sources.push({
            title: extractDomain(url),
            url,
          })
        }
      }

      const duration = Date.now() - startTime
      console.log("[Jina Tool] DeepSearch completed:", {
        answerLength: answer.length,
        sourceCount: sources.length,
        visitedUrlCount: visitedURLs.length,
        readUrlCount: readURLs.length,
        durationMs: duration,
        tokenUsage: usage,
        query,
      })

      return {
        answer: answer || "No answer was generated.",
        sources,
        query,
        reasoningEffort,
        visitedUrls: visitedURLs,
        readUrls: readURLs,
        tokenUsage: usage.prompt_tokens
          ? {
              prompt: usage.prompt_tokens,
              completion: usage.completion_tokens,
            }
          : undefined,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      const isTimeout =
        errorMessage.includes("aborted") || errorMessage.includes("timeout")

      console.error("[Jina Tool] DeepSearch failed:", {
        error: errorMessage,
        durationMs: duration,
        query,
        isTimeout,
      })

      // Return graceful fallback instead of throwing
      return {
        answer: isTimeout
          ? "Deep research timed out after 120 seconds. I'll provide what information I can from my existing knowledge."
          : `Deep research encountered an error: ${errorMessage}. I'll answer based on my existing knowledge instead.`,
        sources: [],
        query,
        reasoningEffort,
      }
    }
  },
})

/**
 * Extract domain name from URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return url
  }
}

/**
 * Check if Jina DeepSearch tool should be enabled
 * Returns true if JINA_API_KEY is configured
 */
export function shouldEnableJinaTool(): boolean {
  return isJinaEnabled()
}
