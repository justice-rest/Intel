/**
 * Notion Content Extractor
 *
 * Converts Notion blocks to plain text for RAG indexing.
 */

import type { NotionBlock, NotionRichText, NotionPage, NotionDatabase } from "../types"
import { getPageTitle, getDatabaseTitle } from "./client"

// ============================================================================
// RICH TEXT EXTRACTION
// ============================================================================

/**
 * Extract plain text from rich text array
 */
export function extractRichText(richTextArray: NotionRichText[]): string {
  if (!richTextArray || !Array.isArray(richTextArray)) {
    return ""
  }
  return richTextArray.map((rt) => rt.plain_text || "").join("")
}

// ============================================================================
// BLOCK TO TEXT CONVERSION
// ============================================================================

/**
 * Convert a single block to text
 */
export function blockToText(block: NotionBlock): string {
  switch (block.type) {
    case "paragraph":
      return extractRichText(block.paragraph?.rich_text || [])

    case "heading_1":
      return `# ${extractRichText(block.heading_1?.rich_text || [])}`

    case "heading_2":
      return `## ${extractRichText(block.heading_2?.rich_text || [])}`

    case "heading_3":
      return `### ${extractRichText(block.heading_3?.rich_text || [])}`

    case "bulleted_list_item":
      return `- ${extractRichText(block.bulleted_list_item?.rich_text || [])}`

    case "numbered_list_item":
      return `1. ${extractRichText(block.numbered_list_item?.rich_text || [])}`

    case "toggle":
      return `> ${extractRichText(block.toggle?.rich_text || [])}`

    case "quote":
      return `> ${extractRichText(block.quote?.rich_text || [])}`

    case "callout":
      const calloutText = extractRichText(block.callout?.rich_text || [])
      const icon = block.callout?.icon?.type === "emoji" ? block.callout.icon.emoji : ""
      return icon ? `${icon} ${calloutText}` : calloutText

    case "code":
      const codeText = extractRichText(block.code?.rich_text || [])
      const language = block.code?.language || ""
      return `\`\`\`${language}\n${codeText}\n\`\`\``

    case "to_do":
      const checked = block.to_do?.checked ? "[x]" : "[ ]"
      return `${checked} ${extractRichText(block.to_do?.rich_text || [])}`

    case "table_row":
      if (block.table_row?.cells) {
        return block.table_row.cells
          .map((cell) => extractRichText(cell))
          .join(" | ")
      }
      return ""

    case "divider":
      return "---"

    case "child_page":
      return `[Page: ${block.child_page?.title || "Untitled"}]`

    case "child_database":
      return `[Database: ${block.child_database?.title || "Untitled"}]`

    default:
      return ""
  }
}

// ============================================================================
// FULL PAGE EXTRACTION
// ============================================================================

/**
 * Extract all text content from a list of blocks
 */
export function extractTextFromBlocks(blocks: NotionBlock[]): string {
  const textParts: string[] = []

  for (const block of blocks) {
    const text = blockToText(block)
    if (text.trim()) {
      textParts.push(text)
    }
  }

  return textParts.join("\n\n")
}

/**
 * Extract page content with metadata
 */
export function extractPageContent(
  page: NotionPage,
  blocks: NotionBlock[]
): {
  title: string
  content: string
  wordCount: number
  blockCount: number
} {
  const title = getPageTitle(page)
  const content = extractTextFromBlocks(blocks)
  const wordCount = countWords(content)

  return {
    title,
    content: `# ${title}\n\n${content}`,
    wordCount,
    blockCount: blocks.length,
  }
}

/**
 * Extract database content with metadata
 */
export function extractDatabaseContent(
  database: NotionDatabase,
  blocks: NotionBlock[]
): {
  title: string
  content: string
  wordCount: number
  blockCount: number
} {
  const title = getDatabaseTitle(database)
  const description = extractRichText(database.description)
  const blocksContent = extractTextFromBlocks(blocks)

  let content = `# ${title}\n`
  if (description) {
    content += `\n${description}\n`
  }
  if (blocksContent) {
    content += `\n${blocksContent}`
  }

  const wordCount = countWords(content)

  return {
    title,
    content,
    wordCount,
    blockCount: blocks.length,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Generate content hash for change detection
 */
export function generateContentHash(content: string): string {
  // Simple hash using string operations (no crypto needed for change detection)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

/**
 * Truncate content to maximum length
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content
  }
  return content.slice(0, maxLength - 3) + "..."
}
