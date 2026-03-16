import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"

/** Maximum characters from user message to send for title generation */
const MAX_INPUT_CHARS = 500

/** Timeout for the title generation call */
const TITLE_GENERATION_TIMEOUT_MS = 10_000

/** Cheap, fast model for title generation (~$0.15/1M input, $0.60/1M output) */
const TITLE_MODEL = "openai/gpt-4.1-nano"

/**
 * Generate a concise chat title from the first user message.
 *
 * Uses a cheap, fast model via OpenRouter to summarize long user messages
 * into short, readable titles (max ~60 chars). Returns null on any failure
 * so callers can fall back to the original message as the title.
 */
export async function generateChatTitle(
  userMessage: string
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  // Skip generation for already-short messages (they're fine as titles)
  const trimmed = userMessage.trim()
  if (trimmed.length <= 60) return null

  const input = trimmed.length > MAX_INPUT_CHARS
    ? trimmed.substring(0, MAX_INPUT_CHARS) + "..."
    : trimmed

  try {
    const openrouter = createOpenRouter({ apiKey })
    const model = openrouter.chat(TITLE_MODEL)

    const { text } = await generateText({
      model,
      system: `You generate short, descriptive chat titles. Rules:
- Maximum 60 characters
- No quotes, no punctuation at end
- Capture the core intent or topic
- Use title case
- Be specific, not generic (e.g. "Research Compassion First Foundation Grants" not "Research Request")
- Return ONLY the title, nothing else`,
      prompt: input,
      maxTokens: 30,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(TITLE_GENERATION_TIMEOUT_MS),
    })

    const title = text
      .trim()
      .replace(/^["']|["']$/g, "") // Strip wrapping quotes
      .replace(/[.!?]+$/, "")      // Strip trailing punctuation
      .trim()

    // Validate: must be non-empty and reasonable length
    if (!title || title.length < 3 || title.length > 80) return null

    return title
  } catch (error) {
    console.error("[Chat Title] Generation failed:", error)
    return null
  }
}
