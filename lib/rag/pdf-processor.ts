/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files using unpdf (serverless-optimized)
 */

import { extractText, getDocumentProxy } from "unpdf"
import type { PDFProcessingResult } from "./types"

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
    // unpdf handles all DOM polyfills and worker configuration internally
    // It's specifically designed for serverless environments
    console.log("[PDF Processor] Extracting text with unpdf...")

    // unpdf requires Uint8Array, not Buffer
    // Convert if needed (Buffer extends Uint8Array but unpdf checks instanceof)
    const uint8Buffer = buffer instanceof Uint8Array && !(buffer instanceof Buffer)
      ? buffer
      : new Uint8Array(buffer)

    const result = await extractText(uint8Buffer, {
      mergePages: true, // Combine all pages into single text string
    })

    console.log(`[PDF Processor] Text extraction complete`)

    // Extract text from result
    const text = result.text

    if (!text || text.trim().length === 0) {
      throw new Error(
        "No text content found in PDF. The file may be image-only or corrupted."
      )
    }

    // Get page count - unpdf provides this in the result
    const pageCount = result.totalPages || 1

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
    const uint8Buffer = buffer instanceof Uint8Array && !(buffer instanceof Buffer)
      ? buffer
      : new Uint8Array(buffer)

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
      const pageText = content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")

      textPages.push(pageText)
    }

    return textPages.join("\n\n")
  } catch (error) {
    console.error("[PDF Processor] Page range extraction failed:", error)
    throw new Error(
      `Failed to extract pages ${startPage}-${endPage}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
