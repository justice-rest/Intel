/**
 * Memory Extractor Module
 *
 * Automatically extracts important facts from conversations.
 * Also handles explicit "remember this" commands.
 *
 * Enhanced (2026-02-08):
 * - 30s AbortSignal timeout on AI generation
 * - Conversation input truncated to MAX_EXTRACTION_INPUT_CHARS
 * - Existing memories passed as context for contradiction detection
 * - Static vs dynamic classification (supermemory pattern)
 */

import { generateText } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { ExtractedMemory, ExtractionRequest } from "./types"
import {
  EXPLICIT_MEMORY_PATTERNS,
  EXPLICIT_MEMORY_IMPORTANCE,
  AUTO_EXTRACT_MIN_IMPORTANCE,
  MEMORY_CATEGORIES,
  MAX_EXTRACTION_INPUT_CHARS,
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
          is_static: true,
          relationship: "new",
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
 * Build extraction prompt with existing memories for contradiction detection.
 */
function buildExtractionPrompt(existingMemories?: string[]): string {
  const existingSection = existingMemories && existingMemories.length > 0
    ? `
---

## EXISTING MEMORIES (for contradiction/update detection)

The user already has these memories stored. If new information CONTRADICTS an existing memory, mark relationship as "update". If it EXTENDS existing info, mark as "extend". If it's entirely new, mark as "new".

${existingMemories.map((m, i) => `${i + 1}. ${m}`).join("\n")}
`
    : ""

  return `You are a memory extraction assistant. Analyze conversations and extract important facts worth remembering about the user.

---

## HARD CONSTRAINTS (Cannot Violate)
1. Output MUST be a valid JSON array
2. Each memory MUST be 1-2 sentences max
3. Importance scores MUST be 0-1 scale
4. NEVER extract temporary/session-specific context
5. Mark each memory as static or dynamic

---

## STATIC vs DYNAMIC CLASSIFICATION

**Static facts** (is_static: true): Stable identity and preference information that rarely changes.
Examples: name, role, organization, communication preferences, core values.

**Dynamic facts** (is_static: false): Contextual information that may change over time.
Examples: current projects, recent events, evolving goals, temporary situations.
${existingSection}
---

## WHAT TO EXTRACT (High Value)
- Personal information (name, role, organization, budget)
- Ongoing projects or goals (capital campaign, board search)
- Strong preferences or dislikes (communication style)
- Key relationships (board members, major donors)
- Skills, expertise, domain knowledge
- Explicit "remember this" requests
- Long-term context useful in future conversations

---

## FEW-SHOT EXAMPLES: Good vs. Bad Extractions

**USER MESSAGE:** "I'm Sarah, the development director at Portland Art Museum. We're running a $5M capital campaign and I prefer data-driven recommendations."

### GOOD EXTRACTIONS

\`\`\`json
[
  {
    "content": "User's name is Sarah, Development Director at Portland Art Museum",
    "importance": 0.95,
    "category": "user_info",
    "tags": ["name", "title", "organization"],
    "context": "Core identity for addressing user and tailoring advice",
    "is_static": true,
    "relationship": "new"
  },
  {
    "content": "Portland Art Museum is running a $5M capital campaign",
    "importance": 0.9,
    "category": "context",
    "tags": ["campaign", "fundraising", "goal"],
    "context": "Active fundraising goal—relevant to all prospect research",
    "is_static": false,
    "relationship": "new"
  },
  {
    "content": "User prefers data-driven recommendations over vague advice",
    "importance": 0.8,
    "category": "preferences",
    "tags": ["communication-style"],
    "context": "Tailor responses to include metrics and evidence",
    "is_static": true,
    "relationship": "new"
  }
]
\`\`\`

### BAD EXTRACTIONS (Do NOT output these)

- "User said hello" — Generic filler, not worth remembering
- "User asked about prospect research" — Temporary, session-specific
- "User works at a nonprofit and does fundraising and knows about donors" — Too vague, too long

---

## OUTPUT FORMAT

Return a JSON array. If no important facts found, return \`[]\`.

Each memory object:
\`\`\`json
{
  "content": "string (1-2 sentences, specific)",
  "importance": number (0-1),
  "category": "user_info" | "preferences" | "context" | "relationships" | "skills" | "history" | "facts" | "other",
  "tags": ["tag1", "tag2"],
  "context": "Why this is worth remembering",
  "is_static": boolean,
  "relationship": "new" | "update" | "extend"
}
\`\`\``
}

/**
 * Automatically extract memories from conversation using AI
 *
 * @param messages - Conversation messages to analyze
 * @param apiKey - OpenRouter API key
 * @param existingMemories - Existing memory contents for contradiction detection
 * @returns Array of extracted memories
 */
export async function extractMemoriesAuto(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  existingMemories?: string[]
): Promise<ExtractedMemory[]> {
  try {
    // Build and truncate conversation text
    let conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n")

    // Truncate to prevent token overflow
    if (conversationText.length > MAX_EXTRACTION_INPUT_CHARS) {
      conversationText = conversationText.substring(0, MAX_EXTRACTION_INPUT_CHARS) + "\n\n[...truncated]"
    }

    const openrouter = createOpenRouter({
      apiKey,
    })

    // Use a fast, cheap model for extraction
    const extractionModel = openrouter.chat("openai/gpt-4o-mini")

    const { text } = await generateText({
      model: extractionModel,
      system: buildExtractionPrompt(existingMemories),
      prompt: `Analyze this conversation and extract important facts to remember:

${conversationText}

Return a JSON array of extracted memories (or empty array if none found).`,
      maxTokens: 2000,
      abortSignal: AbortSignal.timeout(30000), // 30s safety net
    })

    // Parse JSON response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn("[Memory] No JSON array found in extraction response")
        return []
      }

      const extracted = JSON.parse(jsonMatch[0]) as Array<{
        content: string
        importance: number
        category: string
        tags: string[]
        context: string
        is_static?: boolean
        relationship?: string
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
          is_static: m.is_static ?? false,
          relationship: (m.relationship as ExtractedMemory["relationship"]) || "new",
        }))

      return filteredMemories
    } catch (parseError) {
      console.error("[Memory] Failed to parse extraction JSON:", parseError)
      console.error("[Memory] Raw response:", text.substring(0, 500))
      return []
    }
  } catch (error) {
    console.error("[Memory] Failed to extract memories automatically:", error)
    return []
  }
}

/**
 * Extract all memories (both explicit and automatic)
 *
 * @param request - Extraction request with messages
 * @param apiKey - OpenRouter API key
 * @param existingMemories - Existing memory contents for contradiction detection
 * @returns Combined array of all extracted memories
 */
export async function extractMemories(
  request: ExtractionRequest,
  apiKey: string,
  existingMemories?: string[]
): Promise<ExtractedMemory[]> {
  try {
    // Extract explicit memories (synchronous, fast)
    const explicitMemories = extractExplicitMemories(request.messages)

    // Extract automatic memories (async, uses AI)
    const autoMemories = await extractMemoriesAuto(request.messages, apiKey, existingMemories)

    // Combine both types
    const allMemories = [...explicitMemories, ...autoMemories]

    return allMemories
  } catch (error) {
    console.error("[Memory] Failed to extract memories:", error)
    return []
  }
}

/**
 * Extract memories from a single user message.
 * Optimized for real-time extraction during chat.
 *
 * @param userMessage - User message content
 * @param conversationHistory - Recent conversation history for context
 * @param apiKey - OpenRouter API key
 * @param existingMemories - Existing memory contents for contradiction detection
 * @returns Array of extracted memories
 */
export async function extractMemoriesFromMessage(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string,
  existingMemories?: string[]
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
        is_static: true,
        relationship: "new",
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

  return await extractMemoriesAuto(recentMessages, apiKey, existingMemories)
}
