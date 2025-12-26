/**
 * Gmail Writing Style Analyzer
 * Extracts writing patterns from sent emails to match user's voice
 */

import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import { getSentEmails } from "./client"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { STYLE_ANALYSIS_CONFIG, GMAIL_CONFIG } from "../config"
import type {
  WritingStyleProfile,
  ParsedEmail,
  Formality,
  Warmth,
  Directness,
  GreetingPattern,
  ClosingPattern,
} from "../types"

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedStyle {
  formality: Formality
  warmth: Warmth
  directness: Directness
  greetings: GreetingPattern[]
  closings: ClosingPattern[]
  usesEmojis: boolean
  avgSentenceLength: number
  avgParagraphLength: number
  bulletPointUser: boolean
  signaturePhrases: string[]
  sampleSentences: string[]
}

// ============================================================================
// ANALYSIS HELPERS
// ============================================================================

/**
 * Extract greeting from email body
 */
function extractGreeting(body: string): string | null {
  const lines = body.split("\n").filter((l) => l.trim())
  if (lines.length === 0) return null

  const firstLine = lines[0].trim()

  // Check for common greeting patterns
  for (const greeting of STYLE_ANALYSIS_CONFIG.commonGreetings) {
    if (firstLine.toLowerCase().startsWith(greeting.toLowerCase())) {
      // Return the full greeting line
      const match = firstLine.match(
        new RegExp(`^(${greeting}[^,.\n]*[,!]?)`, "i")
      )
      return match ? match[1].trim() : greeting
    }
  }

  // Check if first line looks like a greeting (short, ends with comma/exclamation)
  if (firstLine.length < 50 && /[,!]$/.test(firstLine)) {
    return firstLine
  }

  return null
}

/**
 * Extract closing from email body
 */
function extractClosing(body: string): string | null {
  const lines = body.split("\n").filter((l) => l.trim())
  if (lines.length < 2) return null

  // Look at last few lines
  const lastLines = lines.slice(-5)

  for (const line of lastLines.reverse()) {
    const trimmed = line.trim()

    for (const closing of STYLE_ANALYSIS_CONFIG.commonClosings) {
      if (trimmed.toLowerCase().startsWith(closing.toLowerCase())) {
        return trimmed
      }
    }
  }

  return null
}

/**
 * Check if text contains emojis
 */
function containsEmojis(text: string): boolean {
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u
  return emojiRegex.test(text)
}

/**
 * Calculate average sentence length
 */
function calcAvgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  if (sentences.length === 0) return 0

  const totalWords = sentences.reduce((sum, sentence) => {
    return sum + sentence.trim().split(/\s+/).length
  }, 0)

  return Math.round(totalWords / sentences.length)
}

/**
 * Calculate average paragraph length
 */
function calcAvgParagraphLength(text: string): number {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 20)
  if (paragraphs.length === 0) return 0

  const totalSentences = paragraphs.reduce((sum, para) => {
    return sum + para.split(/[.!?]+/).filter((s) => s.trim()).length
  }, 0)

  return Math.round(totalSentences / paragraphs.length)
}

/**
 * Check if user uses bullet points
 */
function usesBulletPoints(text: string): boolean {
  const bulletPatterns = [/^[-*•]\s/m, /^\d+\.\s/m, /^[a-z]\)\s/im]
  return bulletPatterns.some((pattern) => pattern.test(text))
}

/**
 * Count pattern frequencies
 */
function countPatternFrequencies(
  patterns: (string | null)[]
): Array<{ text: string; frequency: number }> {
  const counts: Record<string, number> = {}

  for (const pattern of patterns) {
    if (pattern) {
      // Normalize the pattern (remove trailing punctuation variations)
      const normalized = pattern.replace(/[,!.]+$/, "").trim()
      counts[normalized] = (counts[normalized] || 0) + 1
    }
  }

  return Object.entries(counts)
    .map(([text, frequency]) => ({ text, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
}

/**
 * Extract sample sentences from emails
 */
function extractSampleSentences(emails: ParsedEmail[]): string[] {
  const sentences: string[] = []

  for (const email of emails) {
    // Remove greeting and closing
    let body = email.body

    // Remove common greeting lines
    const lines = body.split("\n")
    if (lines.length > 1) {
      const firstLine = lines[0].trim().toLowerCase()
      for (const greeting of STYLE_ANALYSIS_CONFIG.commonGreetings) {
        if (firstLine.startsWith(greeting.toLowerCase())) {
          lines.shift()
          break
        }
      }
      body = lines.join("\n")
    }

    // Extract interesting sentences (not too short, not too long)
    const emailSentences = body
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 200)
      .filter((s) => !s.toLowerCase().includes("unsubscribe"))
      .filter((s) => !s.toLowerCase().includes("click here"))

    sentences.push(...emailSentences.slice(0, 2))
  }

  // Deduplicate and limit
  return [...new Set(sentences)].slice(0, STYLE_ANALYSIS_CONFIG.sampleSentences)
}

// ============================================================================
// AI-POWERED ANALYSIS
// ============================================================================

/**
 * Use AI to analyze writing style from sample emails
 */
async function analyzeWithAI(
  emails: ParsedEmail[]
): Promise<Partial<ExtractedStyle>> {
  // Prepare sample content
  const samples = emails
    .slice(0, 10)
    .map((e) => `Subject: ${e.subject}\n\n${e.body}`)
    .join("\n\n---\n\n")
    .slice(0, 10000) // Limit content size

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  try {
    const { text } = await generateText({
      model: openrouter(STYLE_ANALYSIS_CONFIG.model),
      prompt: `Analyze the writing style of these email samples and extract patterns.

EMAIL SAMPLES:
${samples}

Respond with a JSON object containing:
{
  "formality": "casual" | "neutral" | "formal",
  "warmth": "warm" | "neutral" | "professional",
  "directness": "direct" | "diplomatic" | "elaborate",
  "signaturePhrases": ["phrase1", "phrase2", ...] // unique phrases this person uses often
}

Only respond with valid JSON, no other text.`,
      maxTokens: 500,
    })

    // Parse AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        formality: parsed.formality || "neutral",
        warmth: parsed.warmth || "neutral",
        directness: parsed.directness || "direct",
        signaturePhrases: (parsed.signaturePhrases || []).slice(
          0,
          STYLE_ANALYSIS_CONFIG.signaturePhrases
        ),
      }
    }
  } catch (error) {
    console.error("[StyleAnalyzer] AI analysis failed:", error)
  }

  return {}
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze user's writing style from their sent emails
 */
export async function analyzeWritingStyle(
  userId: string
): Promise<WritingStyleProfile | null> {
  // Fetch sent emails
  const emails = await getSentEmails(userId, STYLE_ANALYSIS_CONFIG.emailsToAnalyze)

  if (emails.length < STYLE_ANALYSIS_CONFIG.minEmails) {
    console.log(
      `[StyleAnalyzer] Not enough emails (${emails.length}/${STYLE_ANALYSIS_CONFIG.minEmails})`
    )
    return null
  }

  // Extract patterns from emails
  const greetings = emails.map((e) => extractGreeting(e.body))
  const closings = emails.map((e) => extractClosing(e.body))
  const allBodies = emails.map((e) => e.body).join("\n\n")

  // Calculate statistics
  const usesEmojis =
    emails.filter((e) => containsEmojis(e.body)).length > emails.length * 0.1
  const avgSentenceLength = calcAvgSentenceLength(allBodies)
  const avgParagraphLength = calcAvgParagraphLength(allBodies)
  const bulletPointUser =
    emails.filter((e) => usesBulletPoints(e.body)).length > emails.length * 0.2

  // Count pattern frequencies
  const greetingPatterns = countPatternFrequencies(greetings).slice(
    0,
    STYLE_ANALYSIS_CONFIG.signaturePhrases
  )
  const closingPatterns = countPatternFrequencies(closings).slice(
    0,
    STYLE_ANALYSIS_CONFIG.signaturePhrases
  )

  // Extract sample sentences
  const sampleSentences = extractSampleSentences(emails)

  // AI analysis for tone
  const aiAnalysis = await analyzeWithAI(emails)

  // Combine into profile
  const profile: WritingStyleProfile = {
    formality: aiAnalysis.formality || "neutral",
    warmth: aiAnalysis.warmth || "neutral",
    directness: aiAnalysis.directness || "direct",
    greetings: greetingPatterns,
    closings: closingPatterns,
    usesEmojis,
    avgSentenceLength,
    avgParagraphLength,
    bulletPointUser,
    signaturePhrases: aiAnalysis.signaturePhrases || [],
    sampleSentences,
    analyzedAt: new Date().toISOString(),
    emailsAnalyzed: emails.length,
  }

  // Store the profile
  await storeStyleProfile(userId, profile)

  return profile
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Store writing style profile in database
 */
async function storeStyleProfile(
  userId: string,
  profile: WritingStyleProfile
): Promise<void> {
  if (!isSupabaseEnabled) return

  const supabase = await createClient()
  if (!supabase) return

  // Calculate formality score (0-1)
  const formalityScore =
    profile.formality === "casual"
      ? 0.2
      : profile.formality === "neutral"
        ? 0.5
        : 0.8

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("user_writing_style").upsert(
    {
      user_id: userId,
      style_profile: profile,
      emails_analyzed: profile.emailsAnalyzed,
      last_analyzed_at: profile.analyzedAt,
      formality_score: formalityScore,
      greeting_patterns: profile.greetings.map((g) => g.text),
      closing_patterns: profile.closings.map((c) => c.text),
      common_phrases: profile.signaturePhrases,
      sample_sentences: profile.sampleSentences,
      uses_emojis: profile.usesEmojis,
    },
    { onConflict: "user_id" }
  )

  if (error) {
    console.error("[StyleAnalyzer] Failed to store profile:", error)
  }
}

/**
 * Get stored writing style profile
 */
export async function getWritingStyleProfile(
  userId: string
): Promise<WritingStyleProfile | null> {
  if (!isSupabaseEnabled) return null

  const supabase = await createClient()
  if (!supabase) return null

  // Using 'any' cast as table is not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("user_writing_style")
    .select("style_profile")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return data.style_profile as WritingStyleProfile
}

/**
 * Build a style prompt for AI draft generation
 */
export function buildStylePrompt(profile: WritingStyleProfile): string {
  const lines: string[] = []

  lines.push("Write in the user's personal email style:")
  lines.push("")

  // Tone
  lines.push(`- Formality: ${profile.formality}`)
  lines.push(`- Warmth: ${profile.warmth}`)
  lines.push(`- Directness: ${profile.directness}`)
  lines.push("")

  // Greeting preferences
  if (profile.greetings.length > 0) {
    lines.push(
      `- Typical greetings: ${profile.greetings.map((g) => `"${g.text}"`).join(", ")}`
    )
  }

  // Closing preferences
  if (profile.closings.length > 0) {
    lines.push(
      `- Typical closings: ${profile.closings.map((c) => `"${c.text}"`).join(", ")}`
    )
  }

  // Writing habits
  lines.push("")
  if (profile.usesEmojis) {
    lines.push("- Uses emojis occasionally")
  } else {
    lines.push("- Avoids emojis")
  }

  if (profile.bulletPointUser) {
    lines.push("- Often uses bullet points for lists")
  }

  lines.push(`- Average sentence length: ~${profile.avgSentenceLength} words`)

  // Signature phrases
  if (profile.signaturePhrases.length > 0) {
    lines.push("")
    lines.push("Signature phrases they often use:")
    for (const phrase of profile.signaturePhrases) {
      lines.push(`- "${phrase}"`)
    }
  }

  // Sample sentences for few-shot learning
  if (profile.sampleSentences.length > 0) {
    lines.push("")
    lines.push("Example sentences from their emails (match this voice):")
    for (const sentence of profile.sampleSentences.slice(0, 5)) {
      lines.push(`- "${sentence}"`)
    }
  }

  return lines.join("\n")
}
