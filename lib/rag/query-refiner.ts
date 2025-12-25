/**
 * Query Refiner - Intelligent Query Expansion and Reformulation
 *
 * When initial retrieval results are insufficient, this module
 * analyzes the query and results to generate improved queries:
 * 1. Query expansion (adding synonyms, related terms)
 * 2. Query decomposition (breaking into sub-queries)
 * 3. Query reformulation (rephrasing for better matches)
 * 4. Hypothetical document generation (HyDE)
 *
 * Part of the Agentic RAG pipeline.
 */

import OpenAI from "openai"

// ============================================================================
// TYPES
// ============================================================================

export interface QueryRefinement {
  /** Original query */
  originalQuery: string
  /** Refined query */
  refinedQuery: string
  /** Type of refinement applied */
  refinementType: RefinementType
  /** Explanation of the refinement */
  reasoning: string
  /** Alternative queries (for multi-query retrieval) */
  alternatives: string[]
  /** Extracted entities for focused search */
  entities: ExtractedEntity[]
  /** Confidence in the refinement (0-1) */
  confidence: number
}

export type RefinementType =
  | "expansion" // Added related terms
  | "decomposition" // Split into sub-queries
  | "reformulation" // Rephrased for clarity
  | "hyde" // Hypothetical document
  | "entity_focus" // Focused on specific entities
  | "none" // No refinement needed

export interface ExtractedEntity {
  /** Entity text */
  text: string
  /** Entity type */
  type: "person" | "organization" | "location" | "date" | "amount" | "other"
  /** Importance for the query */
  importance: number
}

export interface RefineQueryInput {
  /** Original user query */
  originalQuery: string
  /** Current query (may have been refined before) */
  currentQuery: string
  /** Results from current retrieval */
  results: Array<{
    content: string
    relevance: number
    reason?: string
  }>
  /** Current iteration number */
  iteration: number
  /** Model to use */
  model?: string
  /** Maximum alternatives to generate */
  maxAlternatives?: number
}

export interface QueryAnalysis {
  /** Query intent */
  intent: QueryIntent
  /** Key entities */
  entities: ExtractedEntity[]
  /** Query complexity */
  complexity: "simple" | "moderate" | "complex"
  /** Suggested refinement strategy */
  strategy: RefinementType
  /** Why current results are insufficient */
  gapAnalysis: string
}

export type QueryIntent =
  | "factual" // Looking for specific facts
  | "exploratory" // Broad research
  | "comparative" // Comparing options
  | "procedural" // How-to questions
  | "definitional" // What is X?
  | "relational" // Connections between entities

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MODEL = "openai/gpt-4o-mini"
const DEFAULT_MAX_ALTERNATIVES = 3

// Query analysis prompt
const ANALYSIS_PROMPT = `Analyze this search query and the poor results to suggest improvements.

**Original Query**: {originalQuery}
**Current Query**: {currentQuery}
**Iteration**: {iteration}

**Current Results** (with relevance scores):
{results}

Analyze:
1. What is the user's intent?
2. What entities are mentioned?
3. Why are current results insufficient?
4. What refinement strategy would help?

Respond in this exact JSON format:
{
  "intent": "factual|exploratory|comparative|procedural|definitional|relational",
  "entities": [
    {"text": "<entity>", "type": "person|organization|location|date|amount|other", "importance": 0.0-1.0}
  ],
  "complexity": "simple|moderate|complex",
  "strategy": "expansion|decomposition|reformulation|hyde|entity_focus|none",
  "gapAnalysis": "<why results are poor>"
}`

// Query refinement prompt
const REFINEMENT_PROMPT = `Refine this search query based on the analysis.

**Original Query**: {originalQuery}
**Current Query**: {currentQuery}
**Analysis**: {analysis}

**Refinement Strategy**: {strategy}

Generate an improved query. Guidelines:
- For "expansion": Add synonyms, related terms, alternative phrasings
- For "decomposition": Break into focused sub-queries
- For "reformulation": Rephrase for clarity and precision
- For "hyde": Generate a hypothetical answer passage
- For "entity_focus": Focus on key entities with context

Respond in this exact JSON format:
{
  "refinedQuery": "<improved query>",
  "reasoning": "<why this refinement helps>",
  "alternatives": ["<alt query 1>", "<alt query 2>"],
  "confidence": 0.0-1.0
}`

// ============================================================================
// MAIN REFINEMENT FUNCTION
// ============================================================================

/**
 * Refine a query based on poor retrieval results
 */
export async function refineQuery(
  input: RefineQueryInput
): Promise<QueryRefinement> {
  const {
    originalQuery,
    currentQuery,
    results,
    iteration,
    model = DEFAULT_MODEL,
    maxAlternatives = DEFAULT_MAX_ALTERNATIVES,
  } = input

  // Don't refine on first iteration with no results
  if (iteration === 1 && results.length === 0) {
    return noRefinementNeeded(originalQuery, currentQuery)
  }

  // Check if results are actually good enough
  const avgRelevance =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.relevance, 0) / results.length
      : 0

  if (avgRelevance >= 0.7) {
    return noRefinementNeeded(originalQuery, currentQuery)
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.warn("[query-refiner] No API key, using heuristic refinement")
      return heuristicRefinement(originalQuery, currentQuery, results)
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    })

    // Step 1: Analyze the query and results
    const analysis = await analyzeQuery(
      openai,
      model,
      originalQuery,
      currentQuery,
      results,
      iteration
    )

    // Step 2: Generate refinement based on analysis
    const refinement = await generateRefinement(
      openai,
      model,
      originalQuery,
      currentQuery,
      analysis,
      maxAlternatives
    )

    return refinement
  } catch (error) {
    console.error("[query-refiner] Refinement failed:", error)
    return heuristicRefinement(originalQuery, currentQuery, results)
  }
}

/**
 * Analyze query and results
 */
async function analyzeQuery(
  openai: OpenAI,
  model: string,
  originalQuery: string,
  currentQuery: string,
  results: RefineQueryInput["results"],
  iteration: number
): Promise<QueryAnalysis> {
  const resultsStr = results
    .slice(0, 5)
    .map(
      (r, i) =>
        `${i + 1}. [${(r.relevance * 100).toFixed(0)}%] ${truncate(r.content, 200)}${r.reason ? ` (${r.reason})` : ""}`
    )
    .join("\n")

  const prompt = ANALYSIS_PROMPT.replace("{originalQuery}", originalQuery)
    .replace("{currentQuery}", currentQuery)
    .replace("{iteration}", String(iteration))
    .replace("{results}", resultsStr || "No results found")

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("Empty analysis response")
  }

  return JSON.parse(content) as QueryAnalysis
}

/**
 * Generate refined query
 */
async function generateRefinement(
  openai: OpenAI,
  model: string,
  originalQuery: string,
  currentQuery: string,
  analysis: QueryAnalysis,
  maxAlternatives: number
): Promise<QueryRefinement> {
  const prompt = REFINEMENT_PROMPT.replace("{originalQuery}", originalQuery)
    .replace("{currentQuery}", currentQuery)
    .replace("{analysis}", JSON.stringify(analysis))
    .replace("{strategy}", analysis.strategy)

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5, // Slightly higher for creative refinements
    max_tokens: 600,
    response_format: { type: "json_object" },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("Empty refinement response")
  }

  const parsed = JSON.parse(content) as {
    refinedQuery: string
    reasoning: string
    alternatives: string[]
    confidence: number
  }

  return {
    originalQuery,
    refinedQuery: parsed.refinedQuery,
    refinementType: analysis.strategy,
    reasoning: parsed.reasoning,
    alternatives: parsed.alternatives.slice(0, maxAlternatives),
    entities: analysis.entities,
    confidence: parsed.confidence,
  }
}

// ============================================================================
// HEURISTIC REFINEMENT (Fallback)
// ============================================================================

/**
 * Heuristic query refinement without LLM
 */
function heuristicRefinement(
  originalQuery: string,
  currentQuery: string,
  results: RefineQueryInput["results"]
): QueryRefinement {
  // Extract potential entities
  const entities = extractEntitiesHeuristic(originalQuery)

  // Try different refinement strategies
  let refinedQuery = currentQuery
  let refinementType: RefinementType = "none"
  let reasoning = "No refinement applied"

  // Strategy 1: Add quotations around potential proper nouns
  const properNouns = originalQuery.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g)
  if (properNouns && properNouns.length > 0 && !currentQuery.includes('"')) {
    const quoted = properNouns.map((n) => `"${n}"`).join(" ")
    refinedQuery = `${quoted} ${originalQuery
      .replace(new RegExp(properNouns.join("|"), "g"), "")
      .trim()}`
    refinementType = "entity_focus"
    reasoning = "Added quotes around proper nouns for exact matching"
  }
  // Strategy 2: Expand with synonyms for common terms
  else if (results.length > 0) {
    const expanded = expandWithSynonyms(currentQuery)
    if (expanded !== currentQuery) {
      refinedQuery = expanded
      refinementType = "expansion"
      reasoning = "Added synonyms for key terms"
    }
  }
  // Strategy 3: Simplify long queries
  else if (currentQuery.split(/\s+/).length > 10) {
    refinedQuery = simplifyQuery(currentQuery)
    refinementType = "reformulation"
    reasoning = "Simplified overly complex query"
  }

  return {
    originalQuery,
    refinedQuery,
    refinementType,
    reasoning,
    alternatives: generateAlternatives(originalQuery, refinementType),
    entities,
    confidence: 0.5,
  }
}

/**
 * Extract entities using heuristics
 */
function extractEntitiesHeuristic(query: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = []

  // Proper nouns (capitalized words)
  const properNouns = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || []
  for (const noun of properNouns) {
    // Determine type based on patterns
    let type: ExtractedEntity["type"] = "other"
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(noun)) {
      type = "person" // Two capitalized words = likely person
    } else if (
      /Inc|LLC|Corp|Foundation|University|Institute/i.test(noun)
    ) {
      type = "organization"
    }

    entities.push({
      text: noun,
      type,
      importance: 0.8,
    })
  }

  // Dates
  const dates =
    query.match(
      /\b\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?/gi
    ) || []
  for (const date of dates) {
    entities.push({
      text: date,
      type: "date",
      importance: 0.6,
    })
  }

  // Amounts
  const amounts = query.match(/\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*\s*(?:million|billion|thousand)/gi) || []
  for (const amount of amounts) {
    entities.push({
      text: amount,
      type: "amount",
      importance: 0.7,
    })
  }

  return entities
}

/**
 * Expand query with synonyms
 */
function expandWithSynonyms(query: string): string {
  const synonymMap: Record<string, string[]> = {
    donation: ["gift", "contribution", "pledge"],
    donor: ["philanthropist", "benefactor", "contributor", "giver"],
    foundation: ["charity", "nonprofit", "organization"],
    wealthy: ["affluent", "high-net-worth", "prosperous"],
    board: ["director", "trustee", "governance"],
    "real estate": ["property", "properties", "holdings"],
    owns: ["owns", "purchased", "acquired"],
    gave: ["donated", "contributed", "gifted"],
    works: ["employed", "serves", "position"],
  }

  let expanded = query
  for (const [term, synonyms] of Object.entries(synonymMap)) {
    if (query.toLowerCase().includes(term)) {
      const altTerms = synonyms.slice(0, 2).join(" OR ")
      expanded = expanded.replace(
        new RegExp(`\\b${term}\\b`, "i"),
        `(${term} OR ${altTerms})`
      )
      break // Only one expansion per query
    }
  }

  return expanded
}

/**
 * Simplify a complex query
 */
function simplifyQuery(query: string): string {
  const words = query.split(/\s+/)
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "about",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "and",
    "but",
    "or",
    "if",
    "then",
    "so",
    "than",
    "too",
    "very",
    "just",
  ])

  const keyWords = words.filter((w) => !stopWords.has(w.toLowerCase()))
  return keyWords.slice(0, 6).join(" ")
}

/**
 * Generate alternative queries
 */
function generateAlternatives(
  query: string,
  currentType: RefinementType
): string[] {
  const alternatives: string[] = []

  // Question form
  if (!query.includes("?") && !query.toLowerCase().startsWith("what")) {
    alternatives.push(`What is ${query}?`)
  }

  // Noun phrase form
  if (query.toLowerCase().startsWith("what") || query.includes("?")) {
    alternatives.push(
      query
        .replace(/^what\s+(is|are)\s+/i, "")
        .replace(/\?$/, "")
        .trim()
    )
  }

  // Remove common prefixes
  const withoutPrefix = query
    .replace(/^(find|search|look for|get|show me)\s+/i, "")
    .trim()
  if (withoutPrefix !== query) {
    alternatives.push(withoutPrefix)
  }

  return alternatives.slice(0, 3)
}

// ============================================================================
// SPECIALIZED REFINERS
// ============================================================================

/**
 * Refine query for donor prospect research
 */
export async function refineDonorQuery(
  query: string,
  context: {
    prospectName?: string
    knownAffiliations?: string[]
    researchFocus?: string[]
  }
): Promise<QueryRefinement> {
  const { prospectName, knownAffiliations = [], researchFocus = [] } = context

  let refinedQuery = query

  // Add prospect name if not present
  if (prospectName && !query.toLowerCase().includes(prospectName.toLowerCase())) {
    refinedQuery = `"${prospectName}" ${query}`
  }

  // Add known affiliations
  if (knownAffiliations.length > 0) {
    const affiliations = knownAffiliations.slice(0, 2).map((a) => `"${a}"`).join(" OR ")
    refinedQuery = `${refinedQuery} (${affiliations})`
  }

  // Focus on research areas
  if (researchFocus.length > 0) {
    refinedQuery = `${refinedQuery} ${researchFocus.join(" ")}`
  }

  return {
    originalQuery: query,
    refinedQuery,
    refinementType: "entity_focus",
    reasoning: "Added prospect context for focused donor research",
    alternatives: [
      prospectName ? `${prospectName} philanthropy giving history` : query,
      prospectName ? `${prospectName} board positions foundations` : query,
    ],
    entities: prospectName
      ? [{ text: prospectName, type: "person", importance: 1.0 }]
      : [],
    confidence: 0.8,
  }
}

/**
 * Generate HyDE (Hypothetical Document Embedding) query
 */
export async function generateHyDE(
  query: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Fallback: just return the original query
    return query
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })

  const prompt = `Generate a hypothetical document passage that would perfectly answer this query:
Query: ${query}

Write 2-3 sentences that directly answer this query as if you were quoting from a relevant document. Be specific and factual in tone.`

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 200,
  })

  return response.choices[0]?.message?.content || query
}

/**
 * Decompose complex query into sub-queries
 */
export async function decomposeQuery(
  query: string,
  model: string = DEFAULT_MODEL
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Simple heuristic decomposition
    if (query.includes(" and ")) {
      return query.split(" and ").map((q) => q.trim())
    }
    return [query]
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })

  const prompt = `Decompose this complex query into 2-4 simpler sub-queries:
Query: ${query}

Return a JSON array of strings, each a focused sub-query.`

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
    response_format: { type: "json_object" },
  })

  try {
    const content = response.choices[0]?.message?.content
    if (content) {
      const parsed = JSON.parse(content) as { queries: string[] }
      return parsed.queries || [query]
    }
  } catch {
    // Fallback
  }

  return [query]
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * No refinement needed result
 */
function noRefinementNeeded(
  originalQuery: string,
  currentQuery: string
): QueryRefinement {
  return {
    originalQuery,
    refinedQuery: currentQuery,
    refinementType: "none",
    reasoning: "Current results are sufficient or no improvement possible",
    alternatives: [],
    entities: extractEntitiesHeuristic(originalQuery),
    confidence: 1.0,
  }
}

/**
 * Truncate text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  refineQuery as refine,
  refineDonorQuery,
  generateHyDE,
  decomposeQuery,
  heuristicRefinement,
}
