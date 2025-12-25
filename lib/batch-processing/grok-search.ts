/**
 * Grok Native Web Search Module
 * Uses Grok 4.1 Fast with native web search (includes X/Twitter search)
 *
 * Key advantage: Native engine provides both web search AND X (Twitter) search
 * in a single call, with structured annotations for reliable source extraction.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GrokSearchResult {
  answer: string
  sources: Array<{
    name: string
    url: string
    snippet?: string
  }>
  query: string
  tokensUsed: number
  durationMs: number
  error?: string
}

export interface ProspectInput {
  name: string
  address?: string
  employer?: string
  title?: string
  city?: string
  state?: string
}

// OpenRouter native search annotation format
interface SearchAnnotation {
  url: string
  title?: string
  content?: string
  start_index?: number
  end_index?: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROK_BATCH_TIMEOUT_MS = 45000 // 45s for batch
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 2000
const MAX_OUTPUT_TOKENS = 4000

/**
 * Check if Grok search (via OpenRouter) is available for batch processing
 */
export function isGrokSearchAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.OPENROUTER_API_KEY)
}

// ============================================================================
// OPTIMIZED QUERY BUILDER
// ============================================================================

/**
 * Build a HIGHLY optimized query for Grok native search
 * Engineered for MAXIMUM data extraction with prospect research focus
 */
export function buildOptimizedGrokQuery(prospect: ProspectInput): string {
  const { name, address, employer, title, city, state } = prospect

  // Build comprehensive location context
  const locationParts = [city, state].filter(Boolean)
  const location = locationParts.join(", ")

  // Build professional context for disambiguation
  const professionalContext = [title, employer].filter(Boolean).join(" at ")

  // Extract first and last name for search variations
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  const searchableName = nameParts.length > 2 ? `${firstName} ${lastName}` : name

  return `COMPREHENSIVE PROSPECT RESEARCH: "${name}"

IDENTITY CONTEXT (use for disambiguation):
• Full name: ${name}
• Search variant: ${searchableName}
${address ? `• Address: ${address}` : ""}
${location ? `• Location: ${location}` : ""}
${professionalContext ? `• Professional: ${professionalContext}` : ""}

SEARCH THESE SPECIFIC AREAS:

1. REAL ESTATE (HIGH PRIORITY)
   Find: "${searchableName}" property ownership ${location}
   Extract: Property addresses, home values, purchase prices, multiple properties

2. BUSINESS OWNERSHIP
   Find: "${name}" CEO, founder, owner, executive, board member
   Extract: Company names, roles, revenue estimates, founding dates

3. SEC & PUBLIC COMPANY
   Find: "${searchableName}" Form 4, insider, SEC filing
   Extract: Company tickers, insider status, stock holdings

4. POLITICAL GIVING
   Find: "${name}" ${location} political contributions, FEC
   Extract: Total amounts, party affiliation, recipients

5. PHILANTHROPY & FOUNDATIONS
   Find: "${name}" foundation, trustee, donor, philanthropy
   Extract: Foundation names, board roles, major gifts

6. BIOGRAPHY
   Find: "${name}" ${professionalContext || location}
   Extract: Age, education, career history, net worth mentions

OUTPUT REQUIREMENTS:
• CITE ALL SOURCES with URLs
• Use DOLLAR RANGES (e.g., "$2M-$5M" not "$3.5M")
• Mark uncertain data as [Estimated]
• If not found, say "Not found in public records"

Provide a comprehensive research summary with all sources cited inline.`
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = BASE_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMessage = lastError.message.toLowerCase()

      const isRetryable =
        errorMessage.includes("429") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("econnreset") ||
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("socket hang up")

      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.log(`[Grok Search] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

// ============================================================================
// SOURCE EXTRACTION
// ============================================================================

/**
 * Extract sources from Grok response
 * Prefers structured annotations (native format), falls back to regex extraction
 */
function extractSources(
  text: string,
  annotations?: SearchAnnotation[]
): Array<{ name: string; url: string; snippet?: string }> {
  const sources: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()

  // If annotations provided (native format), use them preferentially
  if (annotations && annotations.length > 0) {
    for (const annotation of annotations) {
      if (!annotation.url) continue

      const normalizedUrl = annotation.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
      if (seenUrls.has(normalizedUrl)) continue
      seenUrls.add(normalizedUrl)

      try {
        const domain = new URL(annotation.url).hostname.replace("www.", "")
        sources.push({
          name: annotation.title || domain,
          url: annotation.url,
          snippet: annotation.content,
        })
      } catch {
        // Skip invalid URLs
      }
    }

    return sources.slice(0, 20)
  }

  // Fallback: Extract URLs from response text using regex
  const urlRegex = /https?:\/\/[^\s\)>\]"']+/g
  const matches = text.match(urlRegex)

  if (matches) {
    for (const rawUrl of matches) {
      // Clean URL - remove trailing punctuation
      const url = rawUrl.replace(/[.,;:!?)}\]]+$/, "")

      // Normalize for deduplication
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")

      if (seenUrls.has(normalizedUrl)) continue
      seenUrls.add(normalizedUrl)

      try {
        const domain = new URL(url).hostname.replace("www.", "")
        sources.push({
          name: domain,
          url,
        })
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return sources.slice(0, 20) // Limit to 20 sources
}

// ============================================================================
// MAIN BATCH SEARCH FUNCTION
// ============================================================================

/**
 * Execute Grok native web search for batch processing
 *
 * Key features:
 * - Uses OpenRouter's native web search plugin with Grok model
 * - Includes both web search AND X (Twitter) search
 * - Returns structured annotations for reliable source extraction
 * - 45s timeout with retry logic
 */
export async function grokBatchSearch(
  prospect: ProspectInput,
  apiKey?: string
): Promise<GrokSearchResult> {
  const startTime = Date.now()
  const key = apiKey || process.env.OPENROUTER_API_KEY

  if (!key) {
    return {
      answer: "",
      sources: [],
      query: "",
      tokensUsed: 0,
      durationMs: 0,
      error: "OPENROUTER_API_KEY not configured",
    }
  }

  const query = buildOptimizedGrokQuery(prospect)
  console.log(`[Grok Search] Starting search for: ${prospect.name}`)

  try {
    const data = await withRetry(async () => {
      const response = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://getromy.app",
            "X-Title": "Romy Batch Research - Grok Native",
          },
          body: JSON.stringify({
            model: "x-ai/grok-4.1-fast",
            messages: [
              {
                role: "user",
                content: query,
              },
            ],
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.1,
            plugins: [{ id: "web", engine: "native" }],
            reasoning: { effort: "high" },
          }),
        }),
        GROK_BATCH_TIMEOUT_MS,
        `Grok search timed out after ${GROK_BATCH_TIMEOUT_MS / 1000}s`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })

    const durationMs = Date.now() - startTime
    const answer = data.choices?.[0]?.message?.content || ""

    // Extract sources - prefer annotations if available, fallback to regex
    const annotations = data.annotations as SearchAnnotation[] | undefined
    const sources = extractSources(answer, annotations)

    // Calculate tokens used
    const tokensUsed = (data.usage?.total_tokens) ||
      Math.ceil((query.length + answer.length) / 4)

    console.log(`[Grok Search] Completed in ${durationMs}ms, ${sources.length} sources`)

    return {
      answer,
      sources,
      query,
      tokensUsed,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Grok Search] Failed for ${prospect.name}:`, errorMessage)

    return {
      answer: "",
      sources: [],
      query,
      tokensUsed: Math.ceil(query.length / 4),
      durationMs,
      error: errorMessage,
    }
  }
}

// ============================================================================
// RESULT MERGING
// ============================================================================

/**
 * Merge Grok results with existing sources (Perplexity + LinkUp)
 * Deduplicates by URL and extracts unique insights
 */
export function mergeGrokWithResults(
  grokResult: GrokSearchResult,
  existingSources: Array<{ url: string; title?: string; name?: string }>
): {
  mergedSources: Array<{ name: string; url: string; snippet?: string }>
  grokContribution: string
  grokUniqueInsights: string[]
} {
  const existingUrls = new Set(
    existingSources.map((s) =>
      s.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    )
  )

  // Find unique sources from Grok
  const uniqueSources = grokResult.sources.filter((source) => {
    const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    return !existingUrls.has(normalizedUrl)
  })

  // Generate contribution summary
  let grokContribution = ""
  if (uniqueSources.length > 0) {
    grokContribution = `Grok found ${uniqueSources.length} additional sources`
  } else if (grokResult.sources.length > 0) {
    grokContribution = "Grok corroborated existing sources"
  }

  // Extract unique insights (simple keyword extraction)
  const grokUniqueInsights: string[] = []
  const answer = grokResult.answer.toLowerCase()

  if (answer.includes("property") || answer.includes("real estate")) {
    grokUniqueInsights.push("Property data found")
  }
  if (answer.includes("business") || answer.includes("company") || answer.includes("ceo")) {
    grokUniqueInsights.push("Business affiliation found")
  }
  if (answer.includes("foundation") || answer.includes("philanthrop") || answer.includes("donor")) {
    grokUniqueInsights.push("Philanthropic activity found")
  }
  if (answer.includes("sec") || answer.includes("insider") || answer.includes("form 4")) {
    grokUniqueInsights.push("SEC filing found")
  }
  // New: Check for X/Twitter content
  if (answer.includes("twitter") || answer.includes("x.com") || answer.includes("tweet")) {
    grokUniqueInsights.push("X/Twitter data found")
  }

  return {
    mergedSources: uniqueSources,
    grokContribution,
    grokUniqueInsights,
  }
}
