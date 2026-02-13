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
  EXTRACTION_TIMEOUT_MS,
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

  return `You are a memory extraction assistant. Your job is to observe conversations and extract ANYTHING worth remembering about the user — both explicit facts and implicit signals.

Think of yourself as a thoughtful executive assistant who pays attention to everything: not just what the user says directly, but what their questions and behavior reveal about them.

---

## HARD CONSTRAINTS (Cannot Violate)
1. Output MUST be a valid JSON array
2. Each memory MUST be 1-2 sentences max
3. Importance scores MUST be 0-1 scale
4. Mark each memory as static or dynamic

---

## STATIC vs DYNAMIC CLASSIFICATION

**Static facts** (is_static: true): Stable identity and preference information that rarely changes.
Examples: name, role, organization, communication preferences, core values, recurring interests.

**Dynamic facts** (is_static: false): Contextual information that may change over time.
Examples: current projects, recent events, evolving goals, active research topics, things they're working on right now.
${existingSection}
---

## WHAT TO EXTRACT

### Tier 1: Explicit facts (importance 0.8-1.0)
- Personal information stated directly (name, role, organization)
- Explicit preferences ("I prefer...", "I like...")
- Explicit requests to remember something

### Tier 2: Implied facts (importance 0.5-0.8)
- What the user is working on (inferred from their questions and requests)
- Topics they keep returning to or show strong interest in
- Their expertise level (inferred from how they talk about subjects)
- Relationships mentioned in passing ("my boss", "our board chair John")
- Organizational context ("we just merged", "our fiscal year ends in June")
- Emotional signals about topics (frustration, excitement, urgency)

### Tier 3: Behavioral patterns (importance 0.3-0.5)
- Communication style preferences (brief vs detailed, formal vs casual)
- What kinds of follow-up questions they ask (reveals what they value)
- Topics they research repeatedly (even if they don't say "this matters")
- How they use the tool (prospect research, writing, analysis, brainstorming)
- Time-sensitive context worth remembering for next session ("working on a board presentation for Friday")

---

## INFERENCE RULES

When the user asks a question, ask yourself: "What does this question REVEAL about them?"

- Asking about a specific prospect → they're likely researching that person for a gift ask
- Asking about grant writing → they probably write grants as part of their role
- Researching a specific organization → they may have a relationship or interest in it
- Asking for a specific format → they prefer that communication style
- Repeating similar queries → this is a recurring area of focus

---

## FEW-SHOT EXAMPLES

**CONVERSATION:**
USER: "Can you research David Chen? He's on our gala committee and I think he might be good for a major gift."
ASSISTANT: [provides research]

### GOOD EXTRACTIONS

\`\`\`json
[
  {
    "content": "User is researching David Chen as a potential major gift prospect",
    "importance": 0.7,
    "category": "context",
    "tags": ["prospect-research", "major-gifts"],
    "context": "Active prospect — relevant if user asks about major gift pipeline later",
    "is_static": false,
    "relationship": "new"
  },
  {
    "content": "User's organization has a gala committee, and David Chen serves on it",
    "importance": 0.6,
    "category": "relationships",
    "tags": ["gala", "committee", "david-chen"],
    "context": "Org structure detail — gala is an active event/program",
    "is_static": false,
    "relationship": "new"
  },
  {
    "content": "User is involved in major gifts fundraising",
    "importance": 0.5,
    "category": "skills",
    "tags": ["fundraising", "major-gifts"],
    "context": "Inferred role focus — tailor future responses toward major gift strategy",
    "is_static": true,
    "relationship": "new"
  }
]
\`\`\`

**CONVERSATION:**
USER: "Help me write a thank-you letter to our top 10 donors from last year's annual fund."
ASSISTANT: [provides letter]

### GOOD EXTRACTIONS

\`\`\`json
[
  {
    "content": "User manages donor stewardship and thank-you communications",
    "importance": 0.5,
    "category": "skills",
    "tags": ["stewardship", "donor-communications"],
    "context": "Inferred from request — useful for tailoring future writing assistance",
    "is_static": true,
    "relationship": "new"
  },
  {
    "content": "User's organization runs an annual fund campaign",
    "importance": 0.6,
    "category": "context",
    "tags": ["annual-fund", "campaign"],
    "context": "Org program detail — relevant to fundraising strategy conversations",
    "is_static": false,
    "relationship": "new"
  }
]
\`\`\`

### BAD EXTRACTIONS (Do NOT output these)

- "User said hello" — Zero information content
- "User asked the AI for help" — True of literally every message
- "User works at a nonprofit and does fundraising and knows about donors" — Too vague and generic

---

## OUTPUT FORMAT

Return a JSON array. If the conversation is truly generic (greetings, small talk with zero information), return \`[]\`. But err on the side of extracting — most real conversations contain SOMETHING worth noting.

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
      prompt: `Analyze this conversation. Extract both EXPLICIT facts the user states AND IMPLICIT signals about who they are, what they care about, and what they're working on.

Ask yourself: "If I were this user's assistant and they came back tomorrow, what would I want to remember from this conversation?"

${conversationText}

Return a JSON array of extracted memories (or empty array if TRULY nothing worth remembering).`,
      maxTokens: 2000,
      abortSignal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS), // 45s safety net (configurable)
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
