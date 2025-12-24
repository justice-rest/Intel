/**
 * Exa Batch Search Module
 * Optimized Exa integration for batch prospect research using Grok 4.1 Fast
 *
 * Uses OpenRouter's Exa plugin with Grok for semantic web search
 * Provides 10+ high-quality sources per prospect
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExaBatchResult {
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

// ============================================================================
// CONFIGURATION
// ============================================================================

const EXA_BATCH_TIMEOUT_MS = 45000 // 45s for batch (Grok + Exa)
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 2000
const EXA_MAX_RESULTS = 12
const MAX_OUTPUT_TOKENS = 4000

/**
 * Check if Exa (via OpenRouter) is available for batch processing
 */
export function isExaAvailable(apiKey?: string): boolean {
  return !!(apiKey || process.env.OPENROUTER_API_KEY)
}

// ============================================================================
// OPTIMIZED QUERY BUILDER
// ============================================================================

/**
 * Build a HIGHLY optimized query for Exa semantic search
 * Engineered for MAXIMUM data extraction with prospect research focus
 */
export function buildOptimizedExaQuery(prospect: ProspectInput): string {
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
      console.log(`[Exa Batch] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`)
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
 * Extract sources from Exa/Grok response text
 * Parses URLs and creates structured source objects
 */
function extractSources(text: string): Array<{ name: string; url: string; snippet?: string }> {
  const sources: Array<{ name: string; url: string; snippet?: string }> = []
  const seenUrls = new Set<string>()
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
 * Execute Exa search via Grok 4.1 Fast for batch processing
 *
 * Key features:
 * - Uses OpenRouter's Exa plugin with Grok model
 * - Returns 12 high-quality semantic search results
 * - Optimized query format for prospect research
 * - 45s timeout with retry logic
 */
export async function exaBatchSearch(
  prospect: ProspectInput,
  apiKey?: string
): Promise<ExaBatchResult> {
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

  const query = buildOptimizedExaQuery(prospect)
  console.log(`[Exa Batch] Starting search for: ${prospect.name}`)

  try {
    const data = await withRetry(async () => {
      const response = await withTimeout(
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://getromy.app",
            "X-Title": "Romy Batch Research - Exa",
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
            plugins: [{ id: "web", engine: "exa", max_results: EXA_MAX_RESULTS }],
            reasoning: { effort: "high" },
          }),
        }),
        EXA_BATCH_TIMEOUT_MS,
        `Exa batch search timed out after ${EXA_BATCH_TIMEOUT_MS / 1000}s`
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    })

    const durationMs = Date.now() - startTime
    const answer = data.choices?.[0]?.message?.content || ""
    const sources = extractSources(answer)

    // Calculate tokens used
    const tokensUsed = (data.usage?.total_tokens) ||
      Math.ceil((query.length + answer.length) / 4)

    console.log(`[Exa Batch] Completed in ${durationMs}ms, ${sources.length} sources`)

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
    console.error(`[Exa Batch] Failed for ${prospect.name}:`, errorMessage)

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
 * Merge Exa results with existing sources (Perplexity + LinkUp)
 * Deduplicates by URL and extracts unique insights
 */
export function mergeExaWithResults(
  exaResult: ExaBatchResult,
  existingSources: Array<{ url: string; title?: string; name?: string }>
): {
  mergedSources: Array<{ name: string; url: string; snippet?: string }>
  exaContribution: string
  exaUniqueInsights: string[]
} {
  const existingUrls = new Set(
    existingSources.map((s) =>
      s.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    )
  )

  // Find unique sources from Exa
  const uniqueSources = exaResult.sources.filter((source) => {
    const normalizedUrl = source.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")
    return !existingUrls.has(normalizedUrl)
  })

  // Generate contribution summary
  let exaContribution = ""
  if (uniqueSources.length > 0) {
    exaContribution = `Exa found ${uniqueSources.length} additional sources`
  } else if (exaResult.sources.length > 0) {
    exaContribution = "Exa corroborated existing sources"
  }

  // Extract unique insights (simple keyword extraction)
  const exaUniqueInsights: string[] = []
  const answer = exaResult.answer.toLowerCase()

  if (answer.includes("property") || answer.includes("real estate")) {
    exaUniqueInsights.push("Property data found")
  }
  if (answer.includes("business") || answer.includes("company") || answer.includes("ceo")) {
    exaUniqueInsights.push("Business affiliation found")
  }
  if (answer.includes("foundation") || answer.includes("philanthrop") || answer.includes("donor")) {
    exaUniqueInsights.push("Philanthropic activity found")
  }
  if (answer.includes("sec") || answer.includes("insider") || answer.includes("form 4")) {
    exaUniqueInsights.push("SEC filing found")
  }

  return {
    mergedSources: uniqueSources,
    exaContribution,
    exaUniqueInsights,
  }
}
