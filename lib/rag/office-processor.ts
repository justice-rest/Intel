/**
 * Office Document Processor
 * Extracts text content from .pptx, .docx, .xlsx, and other Office formats
 * Uses officeparser for unified extraction
 */

import officeParser from "officeparser"
import mammoth from "mammoth"
import { encode } from "gpt-tokenizer"

// ============================================================================
// TYPES
// ============================================================================

export interface OfficeProcessingResult {
  text: string
  wordCount: number
  tokenCount: number
  format: "pptx" | "docx" | "xlsx" | "odt" | "odp" | "ods" | "unknown"
  pageCount?: number
  slideCount?: number
  sheetCount?: number
}

export interface OfficeProcessingError extends Error {
  code: "UNSUPPORTED_FORMAT" | "EXTRACTION_FAILED" | "EMPTY_CONTENT" | "FILE_TOO_LARGE"
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MIN_CONTENT_LENGTH = 10 // Minimum characters to consider valid

// Map MIME types to format names
const MIME_TO_FORMAT: Record<string, OfficeProcessingResult["format"]> = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  // Google Workspace exports (after export, these become the above formats)
  "application/vnd.google-apps.document": "docx",
  "application/vnd.google-apps.presentation": "pptx",
  "application/vnd.google-apps.spreadsheet": "xlsx",
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Clean extracted text (remove excessive whitespace, control characters)
 */
function cleanText(text: string): string {
  return text
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

/**
 * Get format from MIME type
 */
export function getFormatFromMimeType(mimeType: string): OfficeProcessingResult["format"] {
  return MIME_TO_FORMAT[mimeType] || "unknown"
}

/**
 * Check if MIME type is supported
 */
export function isSupportedOfficeFormat(mimeType: string): boolean {
  return mimeType in MIME_TO_FORMAT
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process an Office document and extract text content
 * Supports: .pptx, .docx, .xlsx, .odt, .odp, .ods
 */
export async function processOfficeDocument(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  fileName?: string
): Promise<OfficeProcessingResult> {
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    const error = new Error(
      `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
    ) as OfficeProcessingError
    error.code = "FILE_TOO_LARGE"
    throw error
  }

  const format = getFormatFromMimeType(mimeType)
  if (format === "unknown") {
    const error = new Error(`Unsupported format: ${mimeType}`) as OfficeProcessingError
    error.code = "UNSUPPORTED_FORMAT"
    throw error
  }

  try {
    let text: string

    // For .docx files, use mammoth for better text extraction with formatting
    if (format === "docx") {
      text = await extractDocxWithMammoth(buffer)
    } else {
      // Use officeparser for all other formats
      text = await extractWithOfficeParser(buffer)
    }

    // Clean the extracted text
    text = cleanText(text)

    // Validate content
    if (!text || text.length < MIN_CONTENT_LENGTH) {
      const error = new Error(
        `Document appears to be empty or contains only images/non-text content`
      ) as OfficeProcessingError
      error.code = "EMPTY_CONTENT"
      throw error
    }

    const wordCount = countWords(text)
    const tokenCount = encode(text).length

    return {
      text,
      wordCount,
      tokenCount,
      format,
      // Note: officeparser doesn't provide page/slide counts
      // We could estimate based on content length if needed
    }
  } catch (error) {
    // Re-throw our custom errors
    if ((error as OfficeProcessingError).code) {
      throw error
    }

    // Wrap other errors
    const wrappedError = new Error(
      `Failed to extract text from ${format}: ${error instanceof Error ? error.message : "Unknown error"}`
    ) as OfficeProcessingError
    wrappedError.code = "EXTRACTION_FAILED"
    throw wrappedError
  }
}

/**
 * Extract text from buffer using officeparser
 */
async function extractWithOfficeParser(buffer: Buffer | Uint8Array): Promise<string> {
  // officeparser expects a Buffer
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  return new Promise((resolve, reject) => {
    officeParser.parseOfficeAsync(nodeBuffer, {
      newlineDelimiter: "\n",
      ignoreNotes: false, // Include speaker notes for PPTX
      putNotesAtLast: true, // Append notes at the end
    })
      .then((text: string) => resolve(text))
      .catch((error: Error) => reject(error))
  })
}

/**
 * Extract text from .docx using mammoth (better formatting preservation)
 */
async function extractDocxWithMammoth(buffer: Buffer | Uint8Array): Promise<string> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  const result = await mammoth.extractRawText({ buffer: nodeBuffer })

  // Log any warnings (but don't fail)
  if (result.messages && result.messages.length > 0) {
    console.warn("[OfficeProcessor] Mammoth warnings:", result.messages)
  }

  return result.value
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate slide count from PPTX content (heuristic)
 * Based on typical slide markers in extracted text
 */
export function estimateSlideCount(text: string): number {
  // PPTX text often has slide numbers or natural breaks
  // This is a rough estimate
  const slides = text.split(/(?:^|\n)(?:Slide \d+|^\d+\.|\n{3,})/gi)
  return Math.max(1, slides.filter((s) => s.trim().length > 20).length)
}

/**
 * Estimate page count from DOCX content (heuristic)
 * Based on average words per page (~250)
 */
export function estimatePageCount(wordCount: number): number {
  const WORDS_PER_PAGE = 250
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE))
}

/**
 * Check if buffer appears to be a valid Office document
 * (Checks for ZIP signature since Office docs are ZIP archives)
 */
export function isValidOfficeDocument(buffer: Buffer | Uint8Array): boolean {
  if (buffer.length < 4) return false

  // Check for ZIP signature (Office docs are ZIP archives)
  // PK (0x50 0x4B 0x03 0x04) or PK (0x50 0x4B 0x05 0x06) for empty ZIP
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06)
  )
}

/**
 * Get human-readable format name
 */
export function getFormatDisplayName(format: OfficeProcessingResult["format"]): string {
  const names: Record<OfficeProcessingResult["format"], string> = {
    pptx: "PowerPoint Presentation",
    docx: "Word Document",
    xlsx: "Excel Spreadsheet",
    odt: "OpenDocument Text",
    odp: "OpenDocument Presentation",
    ods: "OpenDocument Spreadsheet",
    unknown: "Unknown Format",
  }
  return names[format]
}
