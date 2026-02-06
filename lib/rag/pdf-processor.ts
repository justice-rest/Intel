/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files using unpdf (serverless-optimized)
 */

import { extractText, getDocumentProxy } from "unpdf"
import type { PDFProcessingResult } from "./types"

const MIN_PRIMARY_EXTRACTION_CHARS = 200

/**
 * Detect language from text (simple heuristic)
 * Returns ISO 639-1 language code
 */
function detectLanguage(text: string): string {
  // Simple heuristic: if text is mostly ASCII, assume English
  // For more robust detection, consider using a library like franc
  const asciiRatio =
    text.split("").filter((char) => char.charCodeAt(0) < 128).length /
    text.length

  // If > 90% ASCII characters, assume English
  return asciiRatio > 0.9 ? "en" : "multilingual"
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  // Remove extra whitespace and split by word boundaries
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Normalize extracted text to avoid downstream DB/chunking issues.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Convert input to the Uint8Array shape expected by unpdf.
 * Always returns a copy because unpdf/pdf.js may transfer and detach buffers internally.
 */
function toUint8Array(buffer: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(buffer)
}

interface ExtractionAttempt {
  method: "unpdf-extractText" | "pdfjs-page-text"
  text: string
  pageCount: number
}

/**
 * Extract text via unpdf's high-level helper.
 */
async function extractWithUnpdf(uint8Buffer: Uint8Array): Promise<ExtractionAttempt> {
  const result = await extractText(uint8Buffer, {
    mergePages: true,
  })

  return {
    method: "unpdf-extractText",
    text: normalizeText(result.text || ""),
    pageCount: result.totalPages || 1,
  }
}

function textFromPageItems(items: unknown[]): string {
  return items
    .map((item) => {
      if (
        item &&
        typeof item === "object" &&
        "str" in item &&
        typeof (item as { str?: unknown }).str === "string"
      ) {
        return (item as { str: string }).str
      }
      return ""
    })
    .join(" ")
}

/**
 * Fallback extractor that reads each page's text content directly.
 * This is more resilient for graphics-heavy PDFs where merge-level extraction can fail.
 */
async function extractWithPageTextFallback(uint8Buffer: Uint8Array): Promise<ExtractionAttempt> {
  const pdf = await getDocumentProxy(uint8Buffer)
  const pageCount = pdf.numPages || 1
  const textPages: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = normalizeText(textFromPageItems(content.items as unknown[]))
      if (pageText) {
        textPages.push(pageText)
      }
    } catch (error) {
      console.warn(
        `[PDF Processor] Failed to extract text from page ${pageNum}/${pageCount}:`,
        error
      )
    }
  }

  return {
    method: "pdfjs-page-text",
    text: normalizeText(textPages.join("\n\n")),
    pageCount,
  }
}

/**
 * Extract text and metadata from PDF buffer
 *
 * Uses unpdf library which is optimized for serverless environments
 * and handles DOM polyfills internally.
 *
 * @param buffer - PDF file as Buffer or Uint8Array
 * @returns Extracted text, page count, word count, and detected language
 */
export async function processPDF(
  buffer: Buffer | Uint8Array
): Promise<PDFProcessingResult> {
  console.log(`[PDF Processor] Starting PDF processing (unpdf), buffer size: ${buffer.length} bytes`)

  try {
    // Keep an immutable source buffer because unpdf/pdf.js may detach transferred buffers.
    const sourceBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    const attempts: ExtractionAttempt[] = []
    let primaryError: unknown = null
    let fallbackError: unknown = null

    // Primary extraction: fastest and works well for standard text PDFs.
    console.log("[PDF Processor] Extracting text with unpdf (primary path)...")
    try {
      const primaryAttempt = await extractWithUnpdf(toUint8Array(sourceBuffer))
      attempts.push(primaryAttempt)
      console.log(
        `[PDF Processor] Primary extraction complete (${primaryAttempt.text.length} chars, ${primaryAttempt.pageCount} pages)`
      )
    } catch (error) {
      primaryError = error
      console.warn("[PDF Processor] Primary extraction failed, trying fallback:", error)
    }

    // Fallback extraction for graphics-heavy PDFs where merge extraction is fragile
    const primaryTextLength = attempts[0]?.text.length || 0
    const shouldRunFallback =
      attempts.length === 0 || primaryTextLength < MIN_PRIMARY_EXTRACTION_CHARS

    if (shouldRunFallback) {
      console.log("[PDF Processor] Running page-level fallback extraction...")
      try {
        const fallbackAttempt = await extractWithPageTextFallback(toUint8Array(sourceBuffer))
        attempts.push(fallbackAttempt)
        console.log(
          `[PDF Processor] Fallback extraction complete (${fallbackAttempt.text.length} chars, ${fallbackAttempt.pageCount} pages)`
        )
      } catch (error) {
        fallbackError = error
        console.warn("[PDF Processor] Fallback extraction failed:", error)
      }
    }

    const selectedAttempt = attempts
      .filter((attempt) => attempt.text.length > 0)
      .sort((a, b) => b.text.length - a.text.length)[0]

    if (!selectedAttempt) {
      const details: string[] = []
      if (primaryError instanceof Error) details.push(`primary: ${primaryError.message}`)
      if (fallbackError instanceof Error) details.push(`fallback: ${fallbackError.message}`)
      const suffix = details.length > 0 ? ` (${details.join("; ")})` : ""
      throw new Error(
        `No extractable text found in PDF. The file may be image-only or corrupted${suffix}`
      )
    }

    if (selectedAttempt.method === "pdfjs-page-text") {
      console.log("[PDF Processor] Using fallback page-level extraction result")
    }

    const text = selectedAttempt.text
    const pageCount = selectedAttempt.pageCount

    // Count words
    const wordCount = countWords(text)
    console.log(`[PDF Processor] Extracted ${wordCount} words from ${pageCount} page(s)`)

    // Detect language
    const language = detectLanguage(text)
    console.log(`[PDF Processor] Language detected: ${language}`)

    return {
      text,
      pageCount,
      wordCount,
      language,
    }
  } catch (error) {
    console.error("[PDF Processor] Processing failed:", error)
    console.error("[PDF Processor] Error stack:", error instanceof Error ? error.stack : "No stack")
    console.error("[PDF Processor] Error type:", error instanceof Error ? error.constructor.name : typeof error)

    // Re-throw with more context
    if (error instanceof Error) {
      const detailedError = new Error(`PDF processing failed: ${error.message}`)
      detailedError.stack = error.stack
      throw detailedError
    }
    throw new Error(`PDF processing failed: ${String(error)}`)
  }
}

/**
 * Validate PDF file before processing
 *
 * @param buffer - File buffer to validate
 * @returns true if valid PDF, false otherwise
 */
export function isValidPDF(buffer: Buffer | Uint8Array): boolean {
  // Check PDF magic bytes: %PDF-
  const magicBytes = buffer.slice(0, 5)
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-

  return Buffer.compare(magicBytes, pdfSignature) === 0
}

/**
 * Extract text from specific page range
 *
 * @param buffer - PDF file buffer
 * @param startPage - Starting page number (1-based)
 * @param endPage - Ending page number (1-based)
 * @returns Extracted text from specified pages
 */
export async function extractPageRange(
  buffer: Buffer | Uint8Array,
  startPage: number,
  endPage: number
): Promise<string> {
  console.log(`[PDF Processor] Extracting pages ${startPage} to ${endPage}`)

  try {
    // unpdf requires Uint8Array, not Buffer
    const uint8Buffer = toUint8Array(buffer)

    // Get document proxy to work with individual pages
    const pdf = await getDocumentProxy(uint8Buffer)

    const textPages: string[] = []

    // Validate page range
    const totalPages = pdf.numPages
    const actualStartPage = Math.max(1, startPage)
    const actualEndPage = Math.min(totalPages, endPage)

    console.log(`[PDF Processor] Document has ${totalPages} pages, extracting ${actualStartPage}-${actualEndPage}`)

    // Extract text from each page in range
    for (let pageNum = actualStartPage; pageNum <= actualEndPage; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()

      // Combine text items from the page
      const pageText = normalizeText(textFromPageItems(content.items as unknown[]))

      textPages.push(pageText)
    }

    return normalizeText(textPages.join("\n\n"))
  } catch (error) {
    console.error("[PDF Processor] Page range extraction failed:", error)
    throw new Error(
      `Failed to extract pages ${startPage}-${endPage}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
