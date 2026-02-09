/**
 * Shared SSE (Server-Sent Events) stream parser for crawl progress events.
 *
 * Used by both the RAG URL import and Knowledge URL import UI components
 * to read SSE streams from their respective API endpoints.
 */

import type { CrawlProgress } from "./types"

/**
 * Read an SSE stream and invoke `onEvent` for each parsed `CrawlProgress`.
 *
 * Handles:
 * - Incremental buffering across chunked reads
 * - `data: ` prefix extraction
 * - `[DONE]` sentinel detection
 * - Residual buffer processing after the stream closes
 * - Malformed JSON gracefully (skipped)
 *
 * @param reader  - The ReadableStreamDefaultReader from `response.body.getReader()`
 * @param onEvent - Callback invoked for each successfully parsed event
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: CrawlProgress) => void
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() || ""

    for (const line of lines) {
      const event = parseSingleSSELine(line)
      if (event) onEvent(event)
    }
  }

  // Process any remaining data in buffer after stream ends
  if (buffer.trim()) {
    const event = parseSingleSSELine(buffer.trim())
    if (event) onEvent(event)
  }
}

/**
 * Parse a single SSE line into a CrawlProgress event, or return null.
 */
function parseSingleSSELine(line: string): CrawlProgress | null {
  if (!line.startsWith("data: ")) return null
  const jsonStr = line.slice(6).trim()
  if (!jsonStr || jsonStr === "[DONE]") return null

  try {
    return JSON.parse(jsonStr) as CrawlProgress
  } catch {
    return null
  }
}
