/**
 * Relevance Grader - LLM-based Document Relevance Scoring
 *
 * Uses a language model to grade how relevant each retrieved document
 * is to the original query. This enables:
 * 1. Filtering out irrelevant results
 * 2. Triggering query refinement when results are poor
 * 3. Providing explainable relevance scores
 *
 * Part of the Agentic RAG pipeline.
 */

import OpenAI from "openai"

// ============================================================================
// TYPES
// ============================================================================

export interface RelevanceGrade {
  /** Relevance score 0-1 */
  score: number
  /** Human-readable reasoning */
  reasoning: string
  /** Key factors that influenced the grade */
  factors: RelevanceFactor[]
  /** Whether document is relevant (above threshold) */
  isRelevant: boolean
  /** Confidence in the grade (0-1) */
  confidence: number
}

export interface RelevanceFactor {
  /** Factor name */
  name: string
  /** Factor contribution (-1 to 1) */
  impact: number
  /** Description */
  description: string
}

export interface GradeRelevanceInput {
  /** Original user query */
  query: string
  /** Document content to grade */
  document: string
  /** Optional metadata for context */
  metadata?: {
    memory_kind?: string
    is_static?: boolean
    importance?: number
    source?: string
  }
  /** Model to use for grading */
  model?: string
  /** Relevance threshold */
  threshold?: number
}

export interface BatchGradeInput {
  query: string
  documents: Array<{
    id: string
    content: string
    metadata?: Record<string, unknown>
  }>
  model?: string
  threshold?: number
  /** Maximum concurrent requests */
  concurrency?: number
}

export interface BatchGradeResult {
  grades: Map<string, RelevanceGrade>
  timing: {
    totalMs: number
    avgPerDocMs: number
  }
  stats: {
    total: number
    relevant: number
    irrelevant: number
    avgScore: number
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MODEL = "openai/gpt-4o-mini"
const DEFAULT_THRESHOLD = 0.7
const DEFAULT_CONCURRENCY = 5

// CONFIDENCE-WEIGHTED + CONTEXT INJECTION: Relevance grading prompt
const GRADING_PROMPT = `## ROLE DEFINITION
You are a precision relevance grader for document retrieval. Your assessments determine which documents get returned to users.

---

## CONTEXT INJECTION (User Query & Document)

[QUERY]
{query}

[DOCUMENT]
{document}

[METADATA]
{metadata}

---

## CONFIDENCE-WEIGHTED GRADING SCALE

Provide a score 0.0-1.0 with explicit confidence level:

| Score | Description | Confidence Required |
|-------|-------------|---------------------|
| **0.9-1.0** | Directly answers query | HIGH (90%+) - Only if document clearly addresses query |
| **0.7-0.8** | Contains key information | HIGH (85%+) - Substantial overlap with query intent |
| **0.5-0.6** | Some useful information | MEDIUM (70%+) - Partial relevance |
| **0.3-0.4** | Tangentially related | MEDIUM (60%+) - Indirect connection |
| **0.1-0.2** | Superficial connection | LOW (50%+) - Minimal overlap |
| **0.0** | Not relevant | HIGH (90%+) - Clearly irrelevant |

**CRITICAL:** If confidence < threshold for your score, LOWER the score.

---

## EVALUATION FACTORS

For each, rate impact from -1 (hurts relevance) to +1 (helps relevance):

1. **Semantic Match**: Does document address query topic?
2. **Information Quality**: Specific, actionable information?
3. **Recency**: Current if time-sensitive (boost static profile facts)?
4. **Completeness**: Full vs. partial answer?
5. **Context Fit**: Metadata signals (is_static, importance, memory_kind)?

---

## OUTPUT FORMAT (JSON)

\`\`\`json
{
  "score": <number 0-1>,
  "reasoning": "<2-3 sentences explaining score>",
  "factors": [
    {"name": "<factor>", "impact": <-1 to 1>, "description": "<brief>"}
  ],
  "confidence": <number 0-1, how confident are you in this grade?>
}
\`\`\`

**HARD CONSTRAINT:** If you would score >0.7 but confidence <0.7, reduce score to 0.5-0.6 and explain uncertainty.`

// ============================================================================
// MAIN GRADING FUNCTION
// ============================================================================

/**
 * Grade the relevance of a document to a query
 */
export async function gradeRelevance(
  input: GradeRelevanceInput
): Promise<RelevanceGrade> {
  const {
    query,
    document,
    metadata,
    model = DEFAULT_MODEL,
    threshold = DEFAULT_THRESHOLD,
  } = input

  // Skip grading for very short documents
  if (document.length < 10) {
    return {
      score: 0,
      reasoning: "Document too short to evaluate",
      factors: [],
      isRelevant: false,
      confidence: 1.0,
    }
  }

  // Quick heuristic pre-check (skip LLM for obviously irrelevant)
  const heuristicScore = quickHeuristicScore(query, document)
  if (heuristicScore < 0.1) {
    return {
      score: heuristicScore,
      reasoning: "No keyword overlap detected",
      factors: [
        {
          name: "keyword_overlap",
          impact: -1,
          description: "Query terms not found in document",
        },
      ],
      isRelevant: false,
      confidence: 0.7,
    }
  }

  try {
    // Get OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.warn("[relevance-grader] No API key, using heuristic fallback")
      return heuristicGrade(query, document, threshold)
    }

    // Build prompt
    const prompt = GRADING_PROMPT.replace("{query}", query)
      .replace("{document}", truncateForGrading(document))
      .replace("{metadata}", metadata ? JSON.stringify(metadata) : "None")

    // Call LLM
    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    })

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistent grading
      max_tokens: 500,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("Empty response from grader")
    }

    // Parse response
    const parsed = JSON.parse(content) as {
      score: number
      reasoning: string
      factors: RelevanceFactor[]
      confidence: number
    }

    // Apply metadata boost for static memories
    let adjustedScore = parsed.score
    if (metadata?.is_static && adjustedScore > 0.3) {
      adjustedScore = Math.min(1.0, adjustedScore * 1.15)
    }

    // Apply importance boost
    if (metadata?.importance && metadata.importance > 0.8) {
      adjustedScore = Math.min(1.0, adjustedScore * 1.1)
    }

    return {
      score: adjustedScore,
      reasoning: parsed.reasoning,
      factors: parsed.factors || [],
      isRelevant: adjustedScore >= threshold,
      confidence: parsed.confidence || 0.8,
    }
  } catch (error) {
    console.error("[relevance-grader] LLM grading failed:", error)
    // Fallback to heuristic grading
    return heuristicGrade(query, document, threshold)
  }
}

/**
 * Batch grade multiple documents
 */
export async function batchGradeRelevance(
  input: BatchGradeInput
): Promise<BatchGradeResult> {
  const {
    query,
    documents,
    model = DEFAULT_MODEL,
    threshold = DEFAULT_THRESHOLD,
    concurrency = DEFAULT_CONCURRENCY,
  } = input

  const startTime = Date.now()
  const grades = new Map<string, RelevanceGrade>()

  // Process in batches to respect rate limits
  const batches: Array<typeof documents> = []
  for (let i = 0; i < documents.length; i += concurrency) {
    batches.push(documents.slice(i, i + concurrency))
  }

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (doc) => {
        const grade = await gradeRelevance({
          query,
          document: doc.content,
          metadata: doc.metadata as GradeRelevanceInput["metadata"],
          model,
          threshold,
        })
        return { id: doc.id, grade }
      })
    )

    for (const { id, grade } of results) {
      grades.set(id, grade)
    }
  }

  const totalMs = Date.now() - startTime
  const allGrades = Array.from(grades.values())
  const relevantCount = allGrades.filter((g) => g.isRelevant).length

  return {
    grades,
    timing: {
      totalMs,
      avgPerDocMs: documents.length > 0 ? totalMs / documents.length : 0,
    },
    stats: {
      total: documents.length,
      relevant: relevantCount,
      irrelevant: documents.length - relevantCount,
      avgScore:
        allGrades.length > 0
          ? allGrades.reduce((sum, g) => sum + g.score, 0) / allGrades.length
          : 0,
    },
  }
}

// ============================================================================
// HEURISTIC GRADING (Fallback)
// ============================================================================

/**
 * Quick heuristic score based on keyword overlap
 */
function quickHeuristicScore(query: string, document: string): number {
  const queryTerms = extractTerms(query)
  const docTerms = new Set(extractTerms(document))

  if (queryTerms.length === 0) return 0.5

  let matches = 0
  for (const term of queryTerms) {
    if (docTerms.has(term)) {
      matches++
    }
  }

  return matches / queryTerms.length
}

/**
 * Full heuristic grading (no LLM)
 */
function heuristicGrade(
  query: string,
  document: string,
  threshold: number
): RelevanceGrade {
  const factors: RelevanceFactor[] = []

  // Factor 1: Keyword overlap
  const keywordScore = quickHeuristicScore(query, document)
  factors.push({
    name: "keyword_overlap",
    impact: keywordScore * 2 - 1, // Convert 0-1 to -1 to 1
    description: `${Math.round(keywordScore * 100)}% query terms found`,
  })

  // Factor 2: Length ratio
  const lengthRatio = Math.min(document.length / 500, 1) // Favor longer docs up to 500 chars
  factors.push({
    name: "content_length",
    impact: lengthRatio * 0.5 - 0.25,
    description: lengthRatio > 0.5 ? "Sufficient content" : "Limited content",
  })

  // Factor 3: Exact phrase match
  const queryLower = query.toLowerCase()
  const docLower = document.toLowerCase()
  const hasExactMatch = docLower.includes(queryLower)
  if (hasExactMatch) {
    factors.push({
      name: "exact_match",
      impact: 0.5,
      description: "Contains exact query phrase",
    })
  }

  // Factor 4: N-gram overlap
  const ngramScore = calculateNgramOverlap(query, document, 2)
  factors.push({
    name: "ngram_overlap",
    impact: ngramScore * 2 - 1,
    description: `${Math.round(ngramScore * 100)}% bigram overlap`,
  })

  // Calculate final score
  const baseScore =
    keywordScore * 0.4 +
    lengthRatio * 0.1 +
    (hasExactMatch ? 0.2 : 0) +
    ngramScore * 0.3

  const score = Math.max(0, Math.min(1, baseScore))

  return {
    score,
    reasoning: `Heuristic grade based on keyword overlap (${Math.round(keywordScore * 100)}%) and content analysis`,
    factors,
    isRelevant: score >= threshold,
    confidence: 0.6, // Lower confidence for heuristic
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract searchable terms from text
 */
function extractTerms(text: string): string[] {
  const stopWords = new Set([
    "a",
    "an",
    "the",
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
    "dare",
    "ought",
    "used",
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
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "and",
    "but",
    "if",
    "or",
    "because",
    "until",
    "while",
    "although",
    "though",
    "unless",
    "since",
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "ourselves",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
    "he",
    "him",
    "his",
    "himself",
    "she",
    "her",
    "hers",
    "herself",
    "it",
    "its",
    "itself",
    "they",
    "them",
    "their",
    "theirs",
    "themselves",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
  ])

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term))
}

/**
 * Calculate n-gram overlap between two texts
 */
function calculateNgramOverlap(
  text1: string,
  text2: string,
  n: number
): number {
  const ngrams1 = new Set(getNgrams(text1.toLowerCase(), n))
  const ngrams2 = new Set(getNgrams(text2.toLowerCase(), n))

  if (ngrams1.size === 0) return 0

  let overlap = 0
  for (const ngram of ngrams1) {
    if (ngrams2.has(ngram)) {
      overlap++
    }
  }

  return overlap / ngrams1.size
}

/**
 * Generate n-grams from text
 */
function getNgrams(text: string, n: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const ngrams: string[] = []

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "))
  }

  return ngrams
}

/**
 * Truncate document for grading (save tokens)
 */
function truncateForGrading(document: string, maxLength: number = 2000): string {
  if (document.length <= maxLength) return document

  // Try to truncate at sentence boundary
  const truncated = document.slice(0, maxLength)
  const lastSentence = truncated.lastIndexOf(". ")

  if (lastSentence > maxLength * 0.7) {
    return truncated.slice(0, lastSentence + 1) + " [truncated]"
  }

  return truncated + "... [truncated]"
}

// ============================================================================
// SPECIALIZED GRADERS
// ============================================================================

/**
 * Grade relevance for donor research context
 */
export async function gradeDonorRelevance(
  query: string,
  document: string,
  context: {
    prospectName?: string
    researchType?: "wealth" | "philanthropy" | "connections" | "general"
  }
): Promise<RelevanceGrade> {
  // Boost score if document mentions the prospect
  const mentionsProspect =
    context.prospectName &&
    document.toLowerCase().includes(context.prospectName.toLowerCase())

  const baseGrade = await gradeRelevance({
    query,
    document,
    metadata: {
      memory_kind: "research",
      source: context.researchType,
    },
  })

  if (mentionsProspect && baseGrade.score > 0.3) {
    return {
      ...baseGrade,
      score: Math.min(1.0, baseGrade.score * 1.2),
      factors: [
        ...baseGrade.factors,
        {
          name: "prospect_mention",
          impact: 0.4,
          description: `Document mentions ${context.prospectName}`,
        },
      ],
    }
  }

  return baseGrade
}

/**
 * Grade relevance for memory retrieval
 */
export async function gradeMemoryRelevance(
  query: string,
  memory: {
    content: string
    memory_kind: string
    is_static: boolean
    importance_score: number
    created_at: Date
  }
): Promise<RelevanceGrade> {
  // Static memories get a relevance boost
  const staticBoost = memory.is_static ? 0.15 : 0

  // Recent memories get a small boost
  const daysSinceCreation =
    (Date.now() - memory.created_at.getTime()) / (1000 * 60 * 60 * 24)
  const recencyBoost = Math.max(0, 0.1 - daysSinceCreation * 0.001)

  const baseGrade = await gradeRelevance({
    query,
    document: memory.content,
    metadata: {
      memory_kind: memory.memory_kind,
      is_static: memory.is_static,
      importance: memory.importance_score,
    },
  })

  const adjustedScore = Math.min(
    1.0,
    baseGrade.score + staticBoost + recencyBoost
  )

  return {
    ...baseGrade,
    score: adjustedScore,
    isRelevant: adjustedScore >= DEFAULT_THRESHOLD,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  gradeRelevance as grade,
  batchGradeRelevance as batchGrade,
  heuristicGrade,
  quickHeuristicScore,
}
