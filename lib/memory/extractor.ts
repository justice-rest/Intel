/**
 * Memory Extractor Module
 *
 * Automatically extracts important facts from conversations
 * Also handles explicit "remember this" commands
 */

import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { ExtractedMemory, ExtractionRequest } from "./types"
import {
  EXPLICIT_MEMORY_PATTERNS,
  EXPLICIT_MEMORY_IMPORTANCE,
  AUTO_EXTRACT_MIN_IMPORTANCE,
  MEMORY_CATEGORIES,
} from "./config"
import type { MemoryCategory } from "./config"

// ============================================================================
// EXPLICIT MEMORY DETECTION
// ============================================================================

/**
 * Detect explicit memory commands in user message
 * Patterns like "remember that...", "don't forget...", etc.
 *
 * @param message - User message content
 * @returns Extracted memory content or null
 */
export function detectExplicitMemory(message: string): string | null {
  for (const pattern of EXPLICIT_MEMORY_PATTERNS) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return null
}

/**
 * Extract explicit memories from conversation
 * Returns memories marked with high importance
 *
 * @param messages - Conversation messages
 * @returns Array of explicit memories
 */
export function extractExplicitMemories(
  messages: Array<{ role: string; content: string }>
): ExtractedMemory[] {
  const explicitMemories: ExtractedMemory[] = []

  messages.forEach((message) => {
    if (message.role === "user") {
      const memoryContent = detectExplicitMemory(message.content)
      if (memoryContent) {
        explicitMemories.push({
          content: memoryContent,
          importance: EXPLICIT_MEMORY_IMPORTANCE,
          category: MEMORY_CATEGORIES.USER_INFO,
          tags: ["explicit", "user-requested"],
          context: `User explicitly requested to remember: "${memoryContent}"`,
        })
      }
    }
  })

  return explicitMemories
}

// ============================================================================
// AUTOMATIC MEMORY EXTRACTION
// ============================================================================

/**
 * Extraction prompt for AI to analyze conversation
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant. Your job is to analyze conversations and extract important facts that should be remembered about the user.

Extract facts that are:
- Personal information (name, role, preferences, etc.)
- Context about ongoing projects or goals
- Important preferences or dislikes
- Relationships with people or organizations
- Skills, expertise, or abilities
- Specific facts the user wants remembered
- Long-term context that would be useful in future conversations

Do NOT extract:
- Generic conversational filler
- Temporary context that's only relevant to the current conversation
- Obvious or trivial information
- Information already well-known (like common knowledge)

For each fact you extract, provide:
1. The memory content (concise, 1-2 sentences max)
2. An importance score from 0-1 (how important is this to remember?)
3. A category (user_info, preferences, context, relationships, skills, history, facts, other)
4. Relevant tags for organization
5. Brief context about why this is important

Return your analysis as a JSON array. If no important facts are found, return an empty array.

Example output:
[
  {
    "content": "User's name is Sarah and she works as a nonprofit director",
    "importance": 0.9,
    "category": "user_info",
    "tags": ["name", "occupation"],
    "context": "Basic personal information for addressing the user"
  },
  {
    "content": "User prefers data-driven approaches and dislikes vague recommendations",
    "importance": 0.7,
    "category": "preferences",
    "tags": ["communication-style", "preferences"],
    "context": "Helps tailor responses to user's working style"
  }
]`

/**
 * Automatically extract memories from conversation using AI
 *
 * @param messages - Conversation messages to analyze
 * @param apiKey - OpenRouter API key
 * @returns Array of extracted memories
 */
export async function extractMemoriesAuto(
  messages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<ExtractedMemory[]> {
  try {
    // Build conversation context
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n")

    const openrouter = createOpenRouter({
      apiKey,
    })

    // Use a fast, cheap model for extraction
    const extractionModel = openrouter.chat("openai/gpt-4o-mini")

    const { text } = await generateText({
      model: extractionModel,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: `Analyze this conversation and extract important facts to remember:

${conversationText}

Return a JSON array of extracted memories (or empty array if none found).`,
      maxTokens: 2000,
    })

    // Parse JSON response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn("No JSON array found in extraction response")
        return []
      }

      const extracted = JSON.parse(jsonMatch[0]) as Array<{
        content: string
        importance: number
        category: string
        tags: string[]
        context: string
      }>

      // Filter by minimum importance
      const filteredMemories = extracted
        .filter((m) => m.importance >= AUTO_EXTRACT_MIN_IMPORTANCE)
        .map((m) => ({
          content: m.content,
          importance: m.importance,
          category: (m.category as MemoryCategory) || MEMORY_CATEGORIES.OTHER,
          tags: m.tags || [],
          context: m.context || "",
        }))

      return filteredMemories
    } catch (parseError) {
      console.error("Failed to parse extraction JSON:", parseError)
      console.error("Raw response:", text)
      return []
    }
  } catch (error) {
    console.error("Failed to extract memories automatically:", error)
    return []
  }
}

/**
 * Extract all memories (both explicit and automatic)
 *
 * @param request - Extraction request with messages
 * @param apiKey - OpenRouter API key
 * @returns Combined array of all extracted memories
 */
export async function extractMemories(
  request: ExtractionRequest,
  apiKey: string
): Promise<ExtractedMemory[]> {
  try {
    // Extract explicit memories (synchronous, fast)
    const explicitMemories = extractExplicitMemories(request.messages)

    // Extract automatic memories (async, uses AI)
    const autoMemories = await extractMemoriesAuto(request.messages, apiKey)

    // Combine both types
    const allMemories = [...explicitMemories, ...autoMemories]

    return allMemories
  } catch (error) {
    console.error("Failed to extract memories:", error)
    return []
  }
}

/**
 * Extract memories from a single user message
 * Optimized for real-time extraction during chat
 *
 * @param userMessage - User message content
 * @param conversationHistory - Recent conversation history for context
 * @param apiKey - OpenRouter API key
 * @returns Array of extracted memories
 */
export async function extractMemoriesFromMessage(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<ExtractedMemory[]> {
  // Check for explicit memory command first (fast path)
  const explicitContent = detectExplicitMemory(userMessage)
  if (explicitContent) {
    return [
      {
        content: explicitContent,
        importance: EXPLICIT_MEMORY_IMPORTANCE,
        category: MEMORY_CATEGORIES.USER_INFO,
        tags: ["explicit"],
        context: `User requested to remember this`,
      },
    ]
  }

  // Check if message contains memorable information
  // Only extract if message is substantial
  if (userMessage.length < 20) {
    return []
  }

  // Build mini-context for extraction
  const recentMessages = [
    ...conversationHistory.slice(-2),
    { role: "user", content: userMessage },
  ]

  return await extractMemoriesAuto(recentMessages, apiKey)
}
