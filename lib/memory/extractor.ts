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
// FEW-SHOT WITH NEGATIVES: Memory extraction prompt
const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction assistant. Analyze conversations and extract important facts worth remembering about the user.

---

## HARD CONSTRAINTS (Cannot Violate)
1. Output MUST be a valid JSON array
2. Each memory MUST be 1-2 sentences max
3. Importance scores MUST be 0-1 scale
4. NEVER extract temporary/session-specific context

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

### ✅ GOOD EXTRACTIONS

\`\`\`json
[
  {
    "content": "User's name is Sarah, Development Director at Portland Art Museum",
    "importance": 0.95,
    "category": "user_info",
    "tags": ["name", "title", "organization"],
    "context": "Core identity for addressing user and tailoring advice"
  },
  {
    "content": "Portland Art Museum is running a $5M capital campaign",
    "importance": 0.9,
    "category": "context",
    "tags": ["campaign", "fundraising", "goal"],
    "context": "Active fundraising goal—relevant to all prospect research"
  },
  {
    "content": "User prefers data-driven recommendations over vague advice",
    "importance": 0.8,
    "category": "preferences",
    "tags": ["communication-style"],
    "context": "Tailor responses to include metrics and evidence"
  }
]
\`\`\`

**Why these are good:**
- Specific, actionable information
- High importance scores for identity/goals
- Clear categories and tags
- Context explains relevance

---

### ❌ BAD EXTRACTIONS (Do NOT output these)

\`\`\`json
[
  {
    "content": "User said hello",
    "importance": 0.3,
    "category": "other",
    "tags": ["greeting"],
    "context": "User started conversation"
  }
]
\`\`\`
**Why it's bad:** Generic filler, not worth remembering

\`\`\`json
[
  {
    "content": "User asked about prospect research",
    "importance": 0.5,
    "category": "context",
    "tags": ["question"],
    "context": "Current conversation topic"
  }
]
\`\`\`
**Why it's bad:** Temporary, session-specific—not long-term valuable

\`\`\`json
[
  {
    "content": "User works at a nonprofit and does fundraising and knows about donors and prospects and campaigns",
    "importance": 0.6,
    "category": "user_info",
    "tags": ["work"],
    "context": "Job info"
  }
]
\`\`\`
**Why it's bad:** Too vague, too long, lacks specific details

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
  "context": "Why this is worth remembering"
}
\`\`\``

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
