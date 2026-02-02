/**
 * Validated Parser with Retry
 *
 * Instructor-style extraction that validates LLM output against Zod schemas
 * and retries with corrective prompts on validation failure.
 */

import { z } from "zod"
import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  ProspectResearchOutputSchema,
  LenientProspectResearchOutputSchema,
  validateProspectOutput,
  parseLenientProspectOutput,
  generateValidationErrorPrompt,
  type ValidatedProspectResearchOutput,
  type LenientProspectResearchOutput,
} from "../schemas/prospect-output"

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionOptions {
  /**
   * Maximum number of retry attempts on validation failure
   * @default 2
   */
  maxRetries?: number

  /**
   * Whether to return partial data on final failure
   * If true, returns lenient parse result; if false, throws error
   * @default true
   */
  returnPartialOnFailure?: boolean

  /**
   * OpenRouter API key (falls back to env)
   */
  apiKey?: string

  /**
   * Model to use for correction prompts
   * @default "anthropic/claude-3-5-haiku-20241022"
   */
  correctionModel?: string

  /**
   * Original system prompt (for context in corrections)
   */
  systemPrompt?: string
}

export interface ExtractionResult<T> {
  success: boolean
  data: T
  validationAttempts: number
  errors?: string[]
  tokensUsed: number
  wasPartial?: boolean
}

// ============================================================================
// JSON EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract JSON from various LLM response formats
 */
export function extractJsonFromResponse(response: string): unknown | null {
  const trimmed = response.trim()

  // Try 1: Direct JSON parse
  try {
    return JSON.parse(trimmed)
  } catch {
    // Not direct JSON
  }

  // Try 2: Extract from ```json code blocks
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim())
    } catch {
      // Invalid JSON in block
    }
  }

  // Try 3: Find JSON object in response (greedy match from first { to last })
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(jsonCandidate)
    } catch {
      // No valid JSON found
    }
  }

  // Try 4: Find JSON array
  const firstBracket = trimmed.indexOf("[")
  const lastBracket = trimmed.lastIndexOf("]")
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = trimmed.slice(firstBracket, lastBracket + 1)
    try {
      return JSON.parse(jsonCandidate)
    } catch {
      // No valid JSON found
    }
  }

  return null
}

/**
 * Clean common JSON issues before parsing
 */
export function cleanJsonString(jsonStr: string): string {
  let cleaned = jsonStr

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1")

  // Fix unquoted keys (simple cases)
  cleaned = cleaned.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')

  // Fix single quotes to double quotes (careful with apostrophes)
  // Only replace quotes that look like they're wrapping values
  cleaned = cleaned.replace(/:(\s*)'([^']*)'/g, ':$1"$2"')

  // Remove control characters that break parsing
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === "\n" || char === "\r" || char === "\t") {
      return char // Keep newlines and tabs
    }
    return ""
  })

  return cleaned
}

// ============================================================================
// VALIDATED EXTRACTION
// ============================================================================

/**
 * Extract and validate LLM response against a schema with retry on failure
 *
 * This is the main extraction function that implements the Instructor pattern:
 * 1. Parse raw response to JSON
 * 2. Validate against strict schema
 * 3. If validation fails, generate correction prompt with specific errors
 * 4. Send correction prompt back to LLM
 * 5. Repeat until valid or max retries reached
 *
 * @example
 * ```ts
 * const result = await extractWithValidation(
 *   llmResponse,
 *   ProspectResearchOutputSchema,
 *   { maxRetries: 2 }
 * )
 * ```
 */
export async function extractWithValidation<T extends z.ZodType>(
  llmResponse: string,
  schema: T,
  options: ExtractionOptions = {}
): Promise<ExtractionResult<z.infer<T>>> {
  const {
    maxRetries = 2,
    returnPartialOnFailure = true,
    apiKey,
    correctionModel = "anthropic/claude-3-5-haiku-20241022",
    systemPrompt,
  } = options

  let totalTokensUsed = 0
  const allErrors: string[] = []
  let currentResponse = llmResponse

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Step 1: Extract JSON from response
    const extracted = extractJsonFromResponse(currentResponse)

    if (extracted === null) {
      const error = `Attempt ${attempt + 1}: Could not extract valid JSON from response`
      console.warn(`[ValidatedParser] ${error}`)
      allErrors.push(error)

      if (attempt < maxRetries) {
        // Ask LLM to fix the JSON format
        const correctionResult = await requestJsonCorrection(
          currentResponse,
          "Response was not valid JSON. Please return ONLY a valid JSON object matching the required schema.",
          { apiKey, correctionModel, systemPrompt }
        )
        currentResponse = correctionResult.text
        totalTokensUsed += correctionResult.tokensUsed
        continue
      }

      // Final attempt failed - return partial or throw
      if (returnPartialOnFailure) {
        console.warn("[ValidatedParser] Returning empty result after JSON extraction failure")
        return {
          success: false,
          data: getEmptyResult(schema) as z.infer<T>,
          validationAttempts: attempt + 1,
          errors: allErrors,
          tokensUsed: totalTokensUsed,
          wasPartial: true,
        }
      }
      throw new Error(`Failed to extract JSON after ${maxRetries + 1} attempts: ${allErrors.join("; ")}`)
    }

    // Step 2: Validate against schema
    const validationResult = schema.safeParse(extracted)

    if (validationResult.success) {
      console.log(`[ValidatedParser] Validation succeeded on attempt ${attempt + 1}`)
      return {
        success: true,
        data: validationResult.data,
        validationAttempts: attempt + 1,
        tokensUsed: totalTokensUsed,
      }
    }

    // Validation failed - collect errors
    // Zod 4 uses .issues instead of .errors
    const zodIssues = (validationResult.error as any).issues || (validationResult.error as any).errors || []
    const errorSummary = zodIssues
      .map((e: { path?: (string | number)[]; message?: string }) => `${(e.path || []).join(".")}: ${e.message || "Unknown error"}`)
      .join("; ")

    console.warn(`[ValidatedParser] Validation failed on attempt ${attempt + 1}: ${errorSummary}`)
    allErrors.push(`Attempt ${attempt + 1}: ${errorSummary}`)

    if (attempt < maxRetries) {
      // Generate correction prompt and retry
      const correctionPrompt = generateValidationErrorPrompt(validationResult.error)
      const correctionResult = await requestJsonCorrection(
        currentResponse,
        correctionPrompt,
        { apiKey, correctionModel, systemPrompt }
      )
      currentResponse = correctionResult.text
      totalTokensUsed += correctionResult.tokensUsed
      continue
    }

    // Final attempt - return partial or throw
    if (returnPartialOnFailure) {
      console.warn("[ValidatedParser] Returning partial result after validation failures")
      return {
        success: false,
        data: applyPartialData(schema, extracted) as z.infer<T>,
        validationAttempts: attempt + 1,
        errors: allErrors,
        tokensUsed: totalTokensUsed,
        wasPartial: true,
      }
    }
    throw new Error(`Validation failed after ${maxRetries + 1} attempts: ${allErrors.join("; ")}`)
  }

  // Should not reach here, but TypeScript needs a return
  throw new Error("Unexpected extraction state")
}

/**
 * Request LLM to correct JSON based on error feedback
 */
async function requestJsonCorrection(
  originalResponse: string,
  correctionPrompt: string,
  options: {
    apiKey?: string
    correctionModel: string
    systemPrompt?: string
  }
): Promise<{ text: string; tokensUsed: number }> {
  const { apiKey, correctionModel, systemPrompt } = options

  const openrouter = createOpenRouter({
    apiKey: apiKey || process.env.OPENROUTER_API_KEY,
  })

  const systemMessage = systemPrompt
    ? `${systemPrompt}\n\nYou are now correcting a previous response that had validation errors.`
    : "You are correcting a JSON response that had validation errors. Return ONLY valid JSON."

  try {
    const result = await generateText({
      model: openrouter.chat(correctionModel),
      system: systemMessage,
      prompt: `Here is my previous response that had errors:

\`\`\`json
${originalResponse.slice(0, 8000)}
\`\`\`

${correctionPrompt}

Return ONLY the corrected JSON, no other text.`,
      maxOutputTokens: 4000,
      temperature: 0.1,
    })

    // AI SDK v5: usage now has inputTokens/outputTokens instead of promptTokens/completionTokens
    const usage = result.usage as { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number } | undefined
    const tokensUsed = (usage?.inputTokens || usage?.promptTokens || 0) + (usage?.outputTokens || usage?.completionTokens || 0)
    console.log(`[ValidatedParser] Correction request used ${tokensUsed} tokens`)

    return {
      text: result.text,
      tokensUsed,
    }
  } catch (error) {
    console.error("[ValidatedParser] Correction request failed:", error)
    // Return original response to allow final fallback
    return { text: originalResponse, tokensUsed: 0 }
  }
}

/**
 * Get empty result for a schema (used when extraction completely fails)
 */
function getEmptyResult(schema: z.ZodType): unknown {
  // Check if this is the ProspectResearchOutputSchema
  if (schema === ProspectResearchOutputSchema || schema === LenientProspectResearchOutputSchema) {
    return parseLenientProspectOutput({})
  }

  // For other schemas, try to construct a minimal valid object
  // This is a best-effort approach
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(shape)) {
      if (value instanceof z.ZodDefault) {
        // Zod 4 has different _def structure
        const defaultVal = (value._def as any).defaultValue
        result[key] = typeof defaultVal === "function" ? defaultVal() : defaultVal
      } else if (value instanceof z.ZodNullable || value instanceof z.ZodOptional) {
        result[key] = null
      } else if (value instanceof z.ZodString) {
        result[key] = ""
      } else if (value instanceof z.ZodNumber) {
        result[key] = 0
      } else if (value instanceof z.ZodBoolean) {
        result[key] = false
      } else if (value instanceof z.ZodArray) {
        result[key] = []
      } else if (value instanceof z.ZodObject) {
        result[key] = getEmptyResult(value)
      }
    }
    return result
  }

  return {}
}

/**
 * Apply partial data with defaults for invalid fields
 */
function applyPartialData(schema: z.ZodType, data: unknown): unknown {
  // For ProspectResearchOutput, use lenient parsing
  if (schema === ProspectResearchOutputSchema) {
    return parseLenientProspectOutput(data)
  }

  // For other schemas, try partial parsing
  if (schema instanceof z.ZodObject) {
    try {
      // Create a partial schema and merge with defaults
      const partialSchema = schema.partial()
      const partialResult = partialSchema.safeParse(data)
      if (partialResult.success) {
        // Merge with empty result to fill in missing fields
        const empty = getEmptyResult(schema) as Record<string, unknown>
        return { ...empty, ...partialResult.data }
      }
    } catch {
      // Fall through to empty result
    }
  }

  return getEmptyResult(schema)
}

// ============================================================================
// SPECIALIZED EXTRACTORS
// ============================================================================

/**
 * Extract prospect research output specifically
 * Optimized for the ProspectResearchOutput schema with specialized handling
 */
export async function extractProspectResearchOutput(
  llmResponse: string,
  options: Omit<ExtractionOptions, "returnPartialOnFailure"> = {}
): Promise<ExtractionResult<ValidatedProspectResearchOutput | LenientProspectResearchOutput>> {
  const result = await extractWithValidation(
    llmResponse,
    ProspectResearchOutputSchema,
    {
      ...options,
      returnPartialOnFailure: true, // Always return partial for prospect data
    }
  )

  // If we got partial data, ensure it conforms to at least lenient schema
  if (result.wasPartial && result.data) {
    const lenientData = parseLenientProspectOutput(result.data)
    return {
      ...result,
      data: lenientData,
    }
  }

  return result as ExtractionResult<ValidatedProspectResearchOutput>
}

/**
 * Simple extraction without retry (for non-critical data)
 */
export function extractOnce<T extends z.ZodType>(
  llmResponse: string,
  schema: T
): { success: boolean; data?: z.infer<T>; error?: string } {
  const extracted = extractJsonFromResponse(llmResponse)

  if (extracted === null) {
    return { success: false, error: "Could not extract JSON from response" }
  }

  const result = schema.safeParse(extracted)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Zod 4 uses .issues instead of .errors
  const zodIssues = (result.error as any).issues || (result.error as any).errors || []
  return {
    success: false,
    error: zodIssues.map((e: { path?: (string | number)[]; message?: string }) => `${(e.path || []).join(".")}: ${e.message || "Unknown error"}`).join("; "),
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if extraction result has meaningful data (not just defaults)
 */
export function hasMinimalData(data: LenientProspectResearchOutput): boolean {
  const hasProperty =
    data.wealth.real_estate.total_value !== null &&
    data.wealth.real_estate.total_value > 0
  const hasBusiness = data.wealth.business_ownership.length > 0
  const hasSecFilings = data.wealth.securities.has_sec_filings
  const hasPoliticalGiving = data.philanthropy.political_giving.total > 0
  const hasFoundations = data.philanthropy.foundation_affiliations.length > 0
  const hasBoards = data.philanthropy.nonprofit_boards.length > 0
  const hasCareer =
    data.background.career_summary &&
    data.background.career_summary.length > 20 &&
    !data.background.career_summary.includes("could not be structured")
  const hasSources = data.sources.length > 0

  return (
    hasProperty ||
    hasBusiness ||
    hasSecFilings ||
    hasPoliticalGiving ||
    hasFoundations ||
    hasBoards ||
    Boolean(hasCareer) ||
    hasSources
  )
}

/**
 * Calculate data quality score (0-100)
 */
export function calculateDataQualityScore(data: LenientProspectResearchOutput): number {
  let score = 0
  const maxScore = 100

  // Sources (up to 25 points)
  score += Math.min(data.sources.length * 5, 25)

  // Wealth data (up to 25 points)
  if (data.wealth.real_estate.total_value) score += 10
  if (data.wealth.real_estate.properties.length > 0) score += 5
  if (data.wealth.business_ownership.length > 0) score += 5
  if (data.wealth.securities.has_sec_filings) score += 5

  // Philanthropy (up to 20 points)
  if (data.philanthropy.political_giving.total > 0) score += 8
  if (data.philanthropy.foundation_affiliations.length > 0) score += 6
  if (data.philanthropy.known_major_gifts.length > 0) score += 6

  // Background (up to 15 points)
  if (data.background.age) score += 3
  if (data.background.education.length > 0) score += 4
  if (data.background.career_summary && data.background.career_summary.length > 50) score += 5
  if (data.background.family.spouse) score += 3

  // Metrics completeness (up to 15 points)
  if (data.metrics.estimated_net_worth_low) score += 5
  if (data.metrics.estimated_gift_capacity) score += 5
  if (data.metrics.romy_score > 0) score += 5

  return Math.min(score, maxScore)
}
