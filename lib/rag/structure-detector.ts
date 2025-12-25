/**
 * Document Structure Detector - Advanced Document Analysis
 *
 * Provides deeper document structure analysis for:
 * - PDF documents (page-aware chunking)
 * - HTML documents (semantic tags)
 * - Structured data (JSON, CSV)
 * - Financial documents (tables, figures)
 *
 * Used by semantic-chunker for intelligent segmentation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentMetadata {
  /** Document type */
  type: DocumentType
  /** Detected language */
  language: string | null
  /** Has headers */
  hasHeaders: boolean
  /** Has tables */
  hasTables: boolean
  /** Has code blocks */
  hasCode: boolean
  /** Has lists */
  hasLists: boolean
  /** Estimated reading level */
  readingLevel: "simple" | "moderate" | "complex"
  /** Detected topics/keywords */
  keywords: string[]
  /** Page count (if applicable) */
  pageCount: number | null
  /** Word count */
  wordCount: number
  /** Character count */
  charCount: number
}

export type DocumentType =
  | "markdown"
  | "html"
  | "plain_text"
  | "code"
  | "json"
  | "csv"
  | "pdf_text"
  | "structured"
  | "unknown"

export interface StructureElement {
  type: ElementType
  content: string
  startOffset: number
  endOffset: number
  metadata: Record<string, unknown>
  children: StructureElement[]
}

export type ElementType =
  | "document"
  | "section"
  | "header"
  | "paragraph"
  | "table"
  | "list"
  | "list_item"
  | "code_block"
  | "blockquote"
  | "image"
  | "link"
  | "emphasis"
  | "page_break"

// ============================================================================
// DOCUMENT TYPE DETECTION
// ============================================================================

/**
 * Detect document type from content
 */
export function detectDocumentType(content: string, filename?: string): DocumentType {
  // Check filename extension first
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "md":
      case "markdown":
        return "markdown"
      case "html":
      case "htm":
        return "html"
      case "json":
        return "json"
      case "csv":
      case "tsv":
        return "csv"
      case "js":
      case "ts":
      case "py":
      case "java":
      case "go":
      case "rs":
      case "rb":
      case "php":
      case "c":
      case "cpp":
      case "h":
        return "code"
      case "txt":
        return "plain_text"
    }
  }

  // Content-based detection
  const trimmed = content.trim()

  // JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed)
      return "json"
    } catch {
      // Not valid JSON
    }
  }

  // HTML detection
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    /<\/?[a-z][\s\S]*>/i.test(trimmed)
  ) {
    return "html"
  }

  // CSV detection (multiple lines with consistent delimiters)
  const lines = trimmed.split("\n").slice(0, 5)
  if (lines.length >= 2) {
    const commaCount = lines[0].split(",").length
    const tabCount = lines[0].split("\t").length

    if (commaCount > 2 || tabCount > 2) {
      const isCSV = lines.every((line) => {
        const cc = line.split(",").length
        const tc = line.split("\t").length
        return Math.abs(cc - commaCount) <= 1 || Math.abs(tc - tabCount) <= 1
      })
      if (isCSV) return "csv"
    }
  }

  // Markdown detection (headers, links, emphasis)
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\[.+\]\(.+\)/, // Links
    /\*\*.+\*\*/, // Bold
    /```[\s\S]*```/, // Code blocks
    /^\s*[-*+]\s+/m, // Lists
  ]
  const markdownScore = markdownPatterns.filter((p) => p.test(trimmed)).length
  if (markdownScore >= 2) return "markdown"

  // Code detection (common patterns)
  const codePatterns = [
    /^(import|from|require|export|const|let|var|function|class|def|fn|pub|async)\s/m,
    /\{[\s\S]*\}/, // Braces
    /^\s*(if|for|while|switch|try|catch)\s*\(/m, // Control structures
    /;\s*$/m, // Semicolons at end of lines
  ]
  const codeScore = codePatterns.filter((p) => p.test(trimmed)).length
  if (codeScore >= 2) return "code"

  // PDF text detection (page markers, weird spacing)
  if (/\f|\x0c|Page \d+ of \d+/i.test(trimmed)) {
    return "pdf_text"
  }

  // Default to plain text or structured based on line patterns
  const avgLineLength =
    trimmed.split("\n").reduce((sum, line) => sum + line.length, 0) /
    Math.max(1, trimmed.split("\n").length)

  if (avgLineLength < 80 && /^\s*[A-Z]/.test(trimmed)) {
    return "structured"
  }

  return "plain_text"
}

// ============================================================================
// DOCUMENT METADATA EXTRACTION
// ============================================================================

/**
 * Extract metadata from document
 */
export function extractMetadata(
  content: string,
  filename?: string
): DocumentMetadata {
  const type = detectDocumentType(content, filename)
  const lines = content.split("\n")
  const words = content.split(/\s+/).filter((w) => w.length > 0)

  // Detect structure elements
  const hasHeaders = /^#{1,6}\s+|^.+\n[=-]{3,}$/m.test(content)
  const hasTables = /\|.+\|/.test(content) && /\|[-:]+\|/.test(content)
  const hasCode = /```[\s\S]*```|^    .+$/m.test(content)
  const hasLists = /^\s*[-*+]\s+|^\s*\d+\.\s+/m.test(content)

  // Estimate reading level based on average sentence length and word complexity
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const avgSentenceLength = words.length / Math.max(1, sentences.length)
  const longWordRatio =
    words.filter((w) => w.length > 8).length / Math.max(1, words.length)

  let readingLevel: "simple" | "moderate" | "complex" = "moderate"
  if (avgSentenceLength < 15 && longWordRatio < 0.1) {
    readingLevel = "simple"
  } else if (avgSentenceLength > 25 || longWordRatio > 0.2) {
    readingLevel = "complex"
  }

  // Extract keywords (simple TF-based extraction)
  const keywords = extractKeywords(content, 10)

  // Detect language (basic)
  const language = detectLanguage(content)

  // Page count (for PDF text)
  let pageCount: number | null = null
  const pageMatches = content.match(/Page \d+ of (\d+)/i)
  if (pageMatches) {
    pageCount = parseInt(pageMatches[1], 10)
  } else {
    const pageBreaks = (content.match(/\f|\x0c/g) || []).length
    if (pageBreaks > 0) pageCount = pageBreaks + 1
  }

  return {
    type,
    language,
    hasHeaders,
    hasTables,
    hasCode,
    hasLists,
    readingLevel,
    keywords,
    pageCount,
    wordCount: words.length,
    charCount: content.length,
  }
}

/**
 * Simple keyword extraction using term frequency
 */
function extractKeywords(content: string, count: number): string[] {
  // Stopwords to filter
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "this", "that", "these",
    "those", "i", "you", "he", "she", "it", "we", "they", "what", "which",
    "who", "when", "where", "why", "how", "all", "each", "every", "both",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just", "about",
  ])

  // Tokenize and count
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w))

  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  // Sort by frequency and return top N
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word)
}

/**
 * Simple language detection based on common words
 */
function detectLanguage(content: string): string | null {
  const sample = content.toLowerCase().substring(0, 1000)

  // Language indicators
  const indicators: Record<string, string[]> = {
    en: ["the", "and", "is", "are", "was", "were", "have", "has"],
    es: ["el", "la", "los", "las", "es", "son", "de", "que"],
    fr: ["le", "la", "les", "de", "et", "est", "sont", "dans"],
    de: ["der", "die", "das", "und", "ist", "sind", "ein", "eine"],
    pt: ["o", "a", "os", "as", "de", "que", "em", "para"],
    it: ["il", "la", "i", "le", "di", "che", "un", "una"],
  }

  let bestLang: string | null = null
  let bestScore = 0

  for (const [lang, words] of Object.entries(indicators)) {
    const score = words.filter((w) =>
      new RegExp(`\\b${w}\\b`, "i").test(sample)
    ).length

    if (score > bestScore) {
      bestScore = score
      bestLang = lang
    }
  }

  return bestScore >= 3 ? bestLang : null
}

// ============================================================================
// STRUCTURE TREE BUILDING
// ============================================================================

/**
 * Build a hierarchical structure tree from document
 */
export function buildStructureTree(content: string): StructureElement {
  const root: StructureElement = {
    type: "document",
    content: content,
    startOffset: 0,
    endOffset: content.length,
    metadata: {},
    children: [],
  }

  // Parse sections based on headers
  const sections = parseIntoSections(content)
  root.children = sections

  return root
}

/**
 * Parse document into hierarchical sections
 */
function parseIntoSections(content: string): StructureElement[] {
  const elements: StructureElement[] = []
  const headerRegex = /^(#{1,6})\s+(.+)$/gm
  let lastIndex = 0
  let match

  const headerStack: Array<{
    level: number
    element: StructureElement
  }> = []

  while ((match = headerRegex.exec(content)) !== null) {
    // Add content before this header
    if (match.index > lastIndex) {
      const beforeContent = content.substring(lastIndex, match.index).trim()
      if (beforeContent) {
        const paragraphs = parseIntoParagraphs(
          beforeContent,
          lastIndex
        )

        // Add to current section or root
        if (headerStack.length > 0) {
          headerStack[headerStack.length - 1].element.children.push(...paragraphs)
        } else {
          elements.push(...paragraphs)
        }
      }
    }

    const level = match[1].length
    const headerText = match[2]

    // Create section element
    const section: StructureElement = {
      type: "section",
      content: "", // Will be filled later
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      metadata: { level, title: headerText },
      children: [
        {
          type: "header",
          content: headerText,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          metadata: { level },
          children: [],
        },
      ],
    }

    // Pop sections of same or higher level
    while (
      headerStack.length > 0 &&
      headerStack[headerStack.length - 1].level >= level
    ) {
      headerStack.pop()
    }

    // Add to parent or root
    if (headerStack.length > 0) {
      headerStack[headerStack.length - 1].element.children.push(section)
    } else {
      elements.push(section)
    }

    headerStack.push({ level, element: section })
    lastIndex = match.index + match[0].length
  }

  // Add remaining content
  if (lastIndex < content.length) {
    const remainingContent = content.substring(lastIndex).trim()
    if (remainingContent) {
      const paragraphs = parseIntoParagraphs(remainingContent, lastIndex)

      if (headerStack.length > 0) {
        headerStack[headerStack.length - 1].element.children.push(...paragraphs)
      } else {
        elements.push(...paragraphs)
      }
    }
  }

  return elements
}

/**
 * Parse text into paragraph elements
 */
function parseIntoParagraphs(
  text: string,
  baseOffset: number
): StructureElement[] {
  const elements: StructureElement[] = []
  const paragraphs = text.split(/\n\n+/)

  let offset = baseOffset
  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) {
      offset += para.length + 2 // Account for \n\n
      continue
    }

    // Detect element type
    let type: ElementType = "paragraph"
    const metadata: Record<string, unknown> = {}

    // List detection
    if (/^\s*[-*+]\s+/.test(trimmed) || /^\s*\d+\.\s+/.test(trimmed)) {
      type = "list"
      metadata.ordered = /^\s*\d+\./.test(trimmed)
    }
    // Code block detection
    else if (trimmed.startsWith("```") || /^\s{4}/.test(trimmed)) {
      type = "code_block"
    }
    // Blockquote detection
    else if (/^\s*>/.test(trimmed)) {
      type = "blockquote"
    }
    // Table detection
    else if (/\|.+\|/.test(trimmed) && /\|[-:]+\|/.test(trimmed)) {
      type = "table"
    }

    elements.push({
      type,
      content: trimmed,
      startOffset: offset,
      endOffset: offset + para.length,
      metadata,
      children: [],
    })

    offset += para.length + 2
  }

  return elements
}

// ============================================================================
// PAGE-AWARE PROCESSING
// ============================================================================

/**
 * Split document by page markers (for PDF text)
 */
export function splitByPages(content: string): Array<{
  pageNumber: number
  content: string
  startOffset: number
  endOffset: number
}> {
  const pages: Array<{
    pageNumber: number
    content: string
    startOffset: number
    endOffset: number
  }> = []

  // Try form feed characters first
  const ffSplit = content.split(/\f|\x0c/)
  if (ffSplit.length > 1) {
    let offset = 0
    ffSplit.forEach((pageContent, i) => {
      pages.push({
        pageNumber: i + 1,
        content: pageContent,
        startOffset: offset,
        endOffset: offset + pageContent.length,
      })
      offset += pageContent.length + 1 // +1 for the form feed
    })
    return pages
  }

  // Try page markers
  const pageMarkerRegex = /(?:^|\n)(?:Page|\[Page\]|---\s*Page)\s*(\d+)/gi
  let match
  let lastIndex = 0
  let lastPageNum = 0

  while ((match = pageMarkerRegex.exec(content)) !== null) {
    const pageNum = parseInt(match[1], 10)

    if (match.index > lastIndex) {
      pages.push({
        pageNumber: lastPageNum || 1,
        content: content.substring(lastIndex, match.index).trim(),
        startOffset: lastIndex,
        endOffset: match.index,
      })
    }

    lastIndex = match.index + match[0].length
    lastPageNum = pageNum
  }

  // Add remaining content
  if (lastIndex < content.length) {
    pages.push({
      pageNumber: lastPageNum || 1,
      content: content.substring(lastIndex).trim(),
      startOffset: lastIndex,
      endOffset: content.length,
    })
  }

  // If no pages found, return as single page
  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      content: content,
      startOffset: 0,
      endOffset: content.length,
    })
  }

  return pages
}

// ============================================================================
// TABLE EXTRACTION
// ============================================================================

export interface TableData {
  headers: string[]
  rows: string[][]
  startOffset: number
  endOffset: number
}

/**
 * Extract tables from markdown content
 */
export function extractTables(content: string): TableData[] {
  const tables: TableData[] = []
  const tableRegex = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)*)/g

  let match
  while ((match = tableRegex.exec(content)) !== null) {
    const tableText = match[1]
    const lines = tableText.trim().split("\n")

    if (lines.length < 2) continue

    // Parse header row
    const headers = lines[0]
      .split("|")
      .filter((c) => c.trim())
      .map((c) => c.trim())

    // Skip separator line, parse data rows
    const rows = lines.slice(2).map((line) =>
      line
        .split("|")
        .filter((c) => c.trim())
        .map((c) => c.trim())
    )

    tables.push({
      headers,
      rows,
      startOffset: match.index,
      endOffset: match.index + tableText.length,
    })
  }

  return tables
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  detectDocumentType as detectType,
  extractMetadata as getMetadata,
  buildStructureTree as parseStructure,
}
