/**
 * Semantic Chunker - Intelligent Document Segmentation
 *
 * Replaces fixed-size chunking with semantic-aware segmentation:
 * - Preserves sentence boundaries
 * - Maintains header context
 * - Detects document structure (tables, lists, code)
 * - Optimal chunk sizes for retrieval (256-512 tokens)
 * - 15-20% overlap for context continuity
 *
 * Research shows semantic chunking improves retrieval by 70%+
 * compared to fixed-size chunking.
 */

import type { ChunkType, CreateRAGChunkV2 } from "../memory/types"

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ChunkingOptions {
  /** Target tokens per chunk (default 384 - optimal for retrieval) */
  targetTokens: number
  /** Minimum tokens per chunk */
  minTokens: number
  /** Maximum tokens per chunk */
  maxTokens: number
  /** Overlap tokens between chunks (15-20% of target) */
  overlapTokens: number
  /** Preserve sentence boundaries */
  preserveSentences: boolean
  /** Extract and track headers */
  extractHeaders: boolean
  /** Include parent header in each chunk */
  includeParentHeader: boolean
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  targetTokens: 384,
  minTokens: 128,
  maxTokens: 512,
  overlapTokens: 64,
  preserveSentences: true,
  extractHeaders: true,
  includeParentHeader: true,
}

// ============================================================================
// SEMANTIC CHUNK INTERFACE
// ============================================================================

export interface SemanticChunk {
  /** Chunk content */
  content: string
  /** Content with header context prepended */
  contentWithContext: string
  /** Parent header (if any) */
  parentHeader: string | null
  /** Full section path (e.g., ["Chapter 1", "Section 1.1"]) */
  sectionPath: string[]
  /** Chunk type */
  chunkType: ChunkType
  /** Position in document (0-indexed) */
  position: number
  /** Page number (if available) */
  pageNumber: number | null
  /** Approximate token count */
  tokenCount: number
  /** Start character offset in original document */
  startOffset: number
  /** End character offset in original document */
  endOffset: number
}

// ============================================================================
// DOCUMENT STRUCTURE
// ============================================================================

interface DocumentStructure {
  headers: HeaderInfo[]
  paragraphs: ParagraphInfo[]
  tables: TableInfo[]
  lists: ListInfo[]
  codeBlocks: CodeBlockInfo[]
}

interface HeaderInfo {
  level: number
  text: string
  startOffset: number
  endOffset: number
}

interface ParagraphInfo {
  text: string
  startOffset: number
  endOffset: number
  parentHeader: string | null
  sectionPath: string[]
}

interface TableInfo {
  content: string
  startOffset: number
  endOffset: number
  parentHeader: string | null
  rowCount: number
  colCount: number
}

interface ListInfo {
  items: string[]
  startOffset: number
  endOffset: number
  parentHeader: string | null
  isOrdered: boolean
}

interface CodeBlockInfo {
  content: string
  language: string | null
  startOffset: number
  endOffset: number
  parentHeader: string | null
}

// ============================================================================
// MAIN CHUNKING FUNCTION
// ============================================================================

/**
 * Semantically chunk a document
 *
 * @param document - Full document text
 * @param options - Chunking options
 * @returns Array of semantic chunks
 */
export async function semanticChunk(
  document: string,
  options: Partial<ChunkingOptions> = {}
): Promise<SemanticChunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (!document || document.trim().length === 0) {
    return []
  }

  // Step 1: Detect document structure
  const structure = detectStructure(document)

  // Step 2: Create initial segments from structure
  const segments = createSegments(document, structure, opts)

  // Step 3: Merge small segments, split large ones
  const normalizedSegments = normalizeSegments(segments, opts)

  // Step 4: Add overlap between chunks
  const chunksWithOverlap = addOverlap(normalizedSegments, opts)

  // Step 5: Finalize chunks with metadata
  return finalizeChunks(chunksWithOverlap, opts)
}

// ============================================================================
// STRUCTURE DETECTION
// ============================================================================

/**
 * Detect document structure (headers, paragraphs, tables, lists, code)
 */
function detectStructure(document: string): DocumentStructure {
  const headers = detectHeaders(document)
  const tables = detectTables(document)
  const codeBlocks = detectCodeBlocks(document)
  const lists = detectLists(document)
  const paragraphs = detectParagraphs(document, headers, tables, codeBlocks, lists)

  return { headers, paragraphs, tables, lists, codeBlocks }
}

/**
 * Detect markdown/text headers
 */
function detectHeaders(document: string): HeaderInfo[] {
  const headers: HeaderInfo[] = []

  // Markdown headers (# ## ### etc.)
  const markdownRegex = /^(#{1,6})\s+(.+)$/gm
  let match
  while ((match = markdownRegex.exec(document)) !== null) {
    headers.push({
      level: match[1].length,
      text: match[2].trim(),
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    })
  }

  // Underline-style headers (===== or -----)
  const underlineH1Regex = /^(.+)\n={3,}$/gm
  while ((match = underlineH1Regex.exec(document)) !== null) {
    headers.push({
      level: 1,
      text: match[1].trim(),
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    })
  }

  const underlineH2Regex = /^(.+)\n-{3,}$/gm
  while ((match = underlineH2Regex.exec(document)) !== null) {
    headers.push({
      level: 2,
      text: match[1].trim(),
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    })
  }

  // Sort by position
  headers.sort((a, b) => a.startOffset - b.startOffset)

  return headers
}

/**
 * Detect tables (markdown tables)
 */
function detectTables(document: string): TableInfo[] {
  const tables: TableInfo[] = []

  // Simple markdown table detection
  const tableRegex = /\|[^\n]+\|\n\|[-:\s|]+\|\n(\|[^\n]+\|\n?)*/g
  let match
  while ((match = tableRegex.exec(document)) !== null) {
    const rows = match[0].trim().split("\n")
    const colCount = (rows[0].match(/\|/g) || []).length - 1

    tables.push({
      content: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      parentHeader: null, // Will be set later
      rowCount: rows.length - 1, // Exclude header separator
      colCount,
    })
  }

  return tables
}

/**
 * Detect code blocks (fenced with ``` or indented)
 */
function detectCodeBlocks(document: string): CodeBlockInfo[] {
  const codeBlocks: CodeBlockInfo[] = []

  // Fenced code blocks
  const fencedRegex = /```(\w*)\n([\s\S]*?)```/g
  let match
  while ((match = fencedRegex.exec(document)) !== null) {
    codeBlocks.push({
      content: match[2],
      language: match[1] || null,
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      parentHeader: null,
    })
  }

  return codeBlocks
}

/**
 * Detect lists (ordered and unordered)
 */
function detectLists(document: string): ListInfo[] {
  const lists: ListInfo[] = []

  // Unordered lists
  const ulRegex = /(?:^|\n)((?:[-*+]\s+.+\n?)+)/g
  let match
  while ((match = ulRegex.exec(document)) !== null) {
    const items = match[1]
      .split(/\n/)
      .filter((line) => /^[-*+]\s+/.test(line))
      .map((line) => line.replace(/^[-*+]\s+/, "").trim())

    if (items.length > 0) {
      lists.push({
        items,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        parentHeader: null,
        isOrdered: false,
      })
    }
  }

  // Ordered lists
  const olRegex = /(?:^|\n)((?:\d+\.\s+.+\n?)+)/g
  while ((match = olRegex.exec(document)) !== null) {
    const items = match[1]
      .split(/\n/)
      .filter((line) => /^\d+\.\s+/.test(line))
      .map((line) => line.replace(/^\d+\.\s+/, "").trim())

    if (items.length > 0) {
      lists.push({
        items,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        parentHeader: null,
        isOrdered: true,
      })
    }
  }

  return lists
}

/**
 * Detect paragraphs (text between structure elements)
 */
function detectParagraphs(
  document: string,
  headers: HeaderInfo[],
  tables: TableInfo[],
  codeBlocks: CodeBlockInfo[],
  lists: ListInfo[]
): ParagraphInfo[] {
  const paragraphs: ParagraphInfo[] = []

  // Get all occupied ranges
  const occupiedRanges: Array<{ start: number; end: number }> = [
    ...headers.map((h) => ({ start: h.startOffset, end: h.endOffset })),
    ...tables.map((t) => ({ start: t.startOffset, end: t.endOffset })),
    ...codeBlocks.map((c) => ({ start: c.startOffset, end: c.endOffset })),
    ...lists.map((l) => ({ start: l.startOffset, end: l.endOffset })),
  ].sort((a, b) => a.start - b.start)

  // Find text between occupied ranges
  let lastEnd = 0
  for (const range of occupiedRanges) {
    if (range.start > lastEnd) {
      const text = document.substring(lastEnd, range.start).trim()
      if (text.length > 0) {
        // Find parent header
        const parentHeader = findParentHeader(lastEnd, headers)
        const sectionPath = buildSectionPath(lastEnd, headers)

        paragraphs.push({
          text,
          startOffset: lastEnd,
          endOffset: range.start,
          parentHeader,
          sectionPath,
        })
      }
    }
    lastEnd = Math.max(lastEnd, range.end)
  }

  // Handle remaining text after last structure element
  if (lastEnd < document.length) {
    const text = document.substring(lastEnd).trim()
    if (text.length > 0) {
      const parentHeader = findParentHeader(lastEnd, headers)
      const sectionPath = buildSectionPath(lastEnd, headers)

      paragraphs.push({
        text,
        startOffset: lastEnd,
        endOffset: document.length,
        parentHeader,
        sectionPath,
      })
    }
  }

  return paragraphs
}

/**
 * Find the nearest parent header for a given position
 */
function findParentHeader(position: number, headers: HeaderInfo[]): string | null {
  let parentHeader: string | null = null
  for (const header of headers) {
    if (header.startOffset < position) {
      parentHeader = header.text
    } else {
      break
    }
  }
  return parentHeader
}

/**
 * Build the full section path for a given position
 */
function buildSectionPath(position: number, headers: HeaderInfo[]): string[] {
  const path: string[] = []
  const stack: HeaderInfo[] = []

  for (const header of headers) {
    if (header.startOffset >= position) break

    // Pop headers of same or higher level
    while (stack.length > 0 && stack[stack.length - 1].level >= header.level) {
      stack.pop()
    }
    stack.push(header)
  }

  return stack.map((h) => h.text)
}

// ============================================================================
// SEGMENT CREATION
// ============================================================================

interface Segment {
  content: string
  type: ChunkType
  parentHeader: string | null
  sectionPath: string[]
  startOffset: number
  endOffset: number
  pageNumber: number | null
}

/**
 * Create initial segments from document structure
 */
function createSegments(
  document: string,
  structure: DocumentStructure,
  opts: ChunkingOptions
): Segment[] {
  const segments: Segment[] = []

  // Add paragraphs as segments
  for (const para of structure.paragraphs) {
    segments.push({
      content: para.text,
      type: "paragraph",
      parentHeader: para.parentHeader,
      sectionPath: para.sectionPath,
      startOffset: para.startOffset,
      endOffset: para.endOffset,
      pageNumber: null,
    })
  }

  // Add tables as segments
  for (const table of structure.tables) {
    const parentHeader = findParentHeader(table.startOffset, structure.headers)
    segments.push({
      content: table.content,
      type: "table",
      parentHeader,
      sectionPath: buildSectionPath(table.startOffset, structure.headers),
      startOffset: table.startOffset,
      endOffset: table.endOffset,
      pageNumber: null,
    })
  }

  // Add lists as segments
  for (const list of structure.lists) {
    const parentHeader = findParentHeader(list.startOffset, structure.headers)
    const content = list.items.map((item, i) =>
      list.isOrdered ? `${i + 1}. ${item}` : `- ${item}`
    ).join("\n")

    segments.push({
      content,
      type: "list",
      parentHeader,
      sectionPath: buildSectionPath(list.startOffset, structure.headers),
      startOffset: list.startOffset,
      endOffset: list.endOffset,
      pageNumber: null,
    })
  }

  // Add code blocks as segments
  for (const code of structure.codeBlocks) {
    const parentHeader = findParentHeader(code.startOffset, structure.headers)
    const content = code.language
      ? `\`\`\`${code.language}\n${code.content}\`\`\``
      : `\`\`\`\n${code.content}\`\`\``

    segments.push({
      content,
      type: "code",
      parentHeader,
      sectionPath: buildSectionPath(code.startOffset, structure.headers),
      startOffset: code.startOffset,
      endOffset: code.endOffset,
      pageNumber: null,
    })
  }

  // Add headers as segments (for context)
  for (const header of structure.headers) {
    segments.push({
      content: "#".repeat(header.level) + " " + header.text,
      type: "header",
      parentHeader: findParentHeader(header.startOffset, structure.headers),
      sectionPath: buildSectionPath(header.startOffset, structure.headers),
      startOffset: header.startOffset,
      endOffset: header.endOffset,
      pageNumber: null,
    })
  }

  // Sort by position
  segments.sort((a, b) => a.startOffset - b.startOffset)

  return segments
}

// ============================================================================
// SEGMENT NORMALIZATION
// ============================================================================

/**
 * Normalize segments - merge small ones, split large ones
 */
function normalizeSegments(
  segments: Segment[],
  opts: ChunkingOptions
): Segment[] {
  const normalized: Segment[] = []

  for (const segment of segments) {
    const tokenCount = estimateTokens(segment.content)

    if (tokenCount > opts.maxTokens) {
      // Split large segment
      const splitSegments = splitSegment(segment, opts)
      normalized.push(...splitSegments)
    } else if (tokenCount < opts.minTokens && normalized.length > 0) {
      // Try to merge with previous segment if same section
      const prev = normalized[normalized.length - 1]
      const prevTokens = estimateTokens(prev.content)

      if (
        prev.parentHeader === segment.parentHeader &&
        prevTokens + tokenCount <= opts.maxTokens
      ) {
        // Merge with previous
        prev.content += "\n\n" + segment.content
        prev.endOffset = segment.endOffset
      } else {
        normalized.push(segment)
      }
    } else {
      normalized.push(segment)
    }
  }

  return normalized
}

/**
 * Split a large segment at sentence boundaries
 */
function splitSegment(segment: Segment, opts: ChunkingOptions): Segment[] {
  const sentences = splitIntoSentences(segment.content)
  const splits: Segment[] = []

  let currentContent = ""
  let currentStart = segment.startOffset

  for (const sentence of sentences) {
    const newContent = currentContent
      ? currentContent + " " + sentence
      : sentence
    const newTokens = estimateTokens(newContent)

    if (newTokens > opts.targetTokens && currentContent) {
      // Save current chunk and start new one
      splits.push({
        ...segment,
        content: currentContent,
        startOffset: currentStart,
        endOffset: currentStart + currentContent.length,
      })
      currentContent = sentence
      currentStart = currentStart + currentContent.length
    } else {
      currentContent = newContent
    }
  }

  // Add remaining content
  if (currentContent) {
    splits.push({
      ...segment,
      content: currentContent,
      startOffset: currentStart,
      endOffset: segment.endOffset,
    })
  }

  return splits.length > 0 ? splits : [segment]
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Sentence boundary detection (basic)
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g
  const sentences: string[] = []
  let match

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim()
    if (sentence.length > 0) {
      sentences.push(sentence)
    }
  }

  return sentences
}

// ============================================================================
// OVERLAP ADDITION
// ============================================================================

/**
 * Add overlap between consecutive chunks for context continuity
 */
function addOverlap(segments: Segment[], opts: ChunkingOptions): Segment[] {
  if (!opts.overlapTokens || segments.length < 2) {
    return segments
  }

  const withOverlap: Segment[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = { ...segments[i] }

    // Add content from previous chunk as prefix overlap
    if (i > 0) {
      const prevContent = segments[i - 1].content
      const overlapText = getLastNTokens(prevContent, opts.overlapTokens)
      if (overlapText && segment.parentHeader === segments[i - 1].parentHeader) {
        segment.content = "..." + overlapText + "\n\n" + segment.content
      }
    }

    withOverlap.push(segment)
  }

  return withOverlap
}

/**
 * Get approximately the last N tokens from text
 */
function getLastNTokens(text: string, n: number): string {
  const words = text.split(/\s+/)
  const targetWords = Math.ceil(n * 0.75) // Approximate tokens to words
  return words.slice(-targetWords).join(" ")
}

// ============================================================================
// FINALIZATION
// ============================================================================

/**
 * Finalize chunks with full metadata
 */
function finalizeChunks(
  segments: Segment[],
  opts: ChunkingOptions
): SemanticChunk[] {
  return segments.map((segment, index) => {
    // Build content with header context
    let contentWithContext = segment.content
    if (opts.includeParentHeader && segment.parentHeader) {
      contentWithContext = `[${segment.parentHeader}]\n\n${segment.content}`
    }

    return {
      content: segment.content,
      contentWithContext,
      parentHeader: segment.parentHeader,
      sectionPath: segment.sectionPath,
      chunkType: segment.type,
      position: index,
      pageNumber: segment.pageNumber,
      tokenCount: estimateTokens(segment.content),
      startOffset: segment.startOffset,
      endOffset: segment.endOffset,
    }
  })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count (approximate: 1 token ≈ 4 characters or 0.75 words)
 */
export function estimateTokens(text: string): number {
  // Use character-based estimation (more reliable)
  return Math.ceil(text.length / 4)
}

/**
 * Convert SemanticChunk to CreateRAGChunkV2 for database storage
 */
export function toRAGChunkV2(
  chunk: SemanticChunk,
  documentId: string,
  userId: string
): Omit<CreateRAGChunkV2, "embedding"> {
  // Generate content hash for deduplication
  const contentHash = simpleHash(chunk.content)

  return {
    document_id: documentId,
    user_id: userId,
    content: chunk.contentWithContext, // Store with context
    chunk_type: chunk.chunkType,
    position: chunk.position,
    parent_header: chunk.parentHeader || undefined,
    section_path: chunk.sectionPath,
    page_number: chunk.pageNumber || undefined,
    token_count: chunk.tokenCount,
    content_hash: contentHash,
  }
}

/**
 * Simple hash function for content deduplication
 */
function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}

/**
 * Batch chunk multiple documents
 */
export async function batchSemanticChunk(
  documents: Array<{ id: string; content: string; userId: string }>,
  options?: Partial<ChunkingOptions>
): Promise<Map<string, SemanticChunk[]>> {
  const results = new Map<string, SemanticChunk[]>()

  for (const doc of documents) {
    const chunks = await semanticChunk(doc.content, options)
    results.set(doc.id, chunks)
  }

  return results
}

/**
 * Get optimal chunking options for different document types
 */
export function getOptionsForDocType(
  docType: "default" | "technical" | "legal" | "conversational"
): ChunkingOptions {
  switch (docType) {
    case "technical":
      return {
        ...DEFAULT_OPTIONS,
        targetTokens: 512, // Larger chunks for technical docs
        maxTokens: 768,
        overlapTokens: 96,
      }
    case "legal":
      return {
        ...DEFAULT_OPTIONS,
        targetTokens: 256, // Smaller chunks for precision
        maxTokens: 384,
        overlapTokens: 48,
        preserveSentences: true,
      }
    case "conversational":
      return {
        ...DEFAULT_OPTIONS,
        targetTokens: 256,
        maxTokens: 384,
        overlapTokens: 32,
      }
    default:
      return DEFAULT_OPTIONS
  }
}
