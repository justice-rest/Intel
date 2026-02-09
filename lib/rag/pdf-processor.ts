/**
 * PDF Processing Module
 * Extracts text and metadata from PDF files using unpdf (serverless-optimized)
 */

import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf"
import type { PDFProcessingResult } from "./types"

const MIN_PRIMARY_EXTRACTION_CHARS = 200

/** Max pages to OCR (cost/latency guard) */
const MAX_OCR_PAGES = 10

/** Scale for OCR rendering (1.5x = ~144 DPI, good quality vs size tradeoff) */
const OCR_RENDER_SCALE = 1.5

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
  method: "unpdf-extractText" | "pdfjs-page-text" | "vision-ocr"
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
 * OCR fallback: render PDF pages as images and use a vision model to extract text.
 * Only triggered when text-layer extraction yields < MIN_PRIMARY_EXTRACTION_CHARS.
 *
 * Uses unpdf's `renderPageAsImage` (which internally uses @napi-rs/canvas)
 * and sends page images to a vision model via OpenRouter.
 *
 * @param uint8Buffer - PDF as Uint8Array
 * @param pageCount - Total pages in the PDF
 * @param apiKey - OpenRouter API key
 * @returns Extracted text, or empty string on failure
 */
async function extractWithVisionOCR(
  uint8Buffer: Uint8Array,
  pageCount: number,
  apiKey: string
): Promise<ExtractionAttempt> {
  const pagesToOcr = Math.min(pageCount, MAX_OCR_PAGES)
  console.log(`[PDF Processor] OCR: rendering ${pagesToOcr} pages as images...`)

  const canvasImport = () => import("@napi-rs/canvas")

  // Render pages as data URLs
  const imageUrls: string[] = []
  for (let pageNum = 1; pageNum <= pagesToOcr; pageNum++) {
    try {
      const dataUrl = await renderPageAsImage(uint8Buffer, pageNum, {
        canvasImport,
        scale: OCR_RENDER_SCALE,
        toDataURL: true,
      })
      // Skip if image is too large (>4MB base64 ≈ 3MB raw — API limit guard)
      if (dataUrl.length > 4 * 1024 * 1024) {
        console.warn(`[PDF Processor] OCR: page ${pageNum} image too large (${(dataUrl.length / 1024 / 1024).toFixed(1)}MB), skipping`)
        continue
      }
      imageUrls.push(dataUrl)
    } catch (error) {
      console.warn(`[PDF Processor] OCR: failed to render page ${pageNum}:`, error)
    }
  }

  if (imageUrls.length === 0) {
    console.warn("[PDF Processor] OCR: no pages could be rendered")
    return { method: "vision-ocr", text: "", pageCount }
  }

  console.log(`[PDF Processor] OCR: sending ${imageUrls.length} page images to vision model...`)

  // Build content array: one image_url per page + extraction prompt
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

  for (let i = 0; i < imageUrls.length; i++) {
    content.push({
      type: "image_url",
      image_url: { url: imageUrls[i] },
    })
  }

  content.push({
    type: "text",
    text: `Extract ALL text from these ${imageUrls.length} PDF page image(s). Preserve the original structure including headings, paragraphs, lists, and tables. Output only the extracted text, no commentary. If a page contains charts or diagrams, describe their data content.`,
  })

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://getromy.app",
        "X-Title": "Romy PDF OCR",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content }],
        max_tokens: 16000,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      console.error(`[PDF Processor] OCR: vision API returned ${response.status}: ${errorText}`)
      return { method: "vision-ocr", text: "", pageCount }
    }

    const data = await response.json()
    const extractedText = normalizeText(data?.choices?.[0]?.message?.content || "")

    console.log(`[PDF Processor] OCR: extracted ${extractedText.length} chars via vision model`)

    return { method: "vision-ocr", text: extractedText, pageCount }
  } catch (error) {
    console.error("[PDF Processor] OCR: vision API call failed:", error)
    return { method: "vision-ocr", text: "", pageCount }
  }
}

/**
 * Extract text and metadata from PDF buffer
 *
 * Uses unpdf library which is optimized for serverless environments
 * and handles DOM polyfills internally.
 *
 * @param buffer - PDF file as Buffer or Uint8Array
 * @param apiKey - Optional OpenRouter API key for OCR fallback on image-heavy PDFs
 * @returns Extracted text, page count, word count, and detected language
 */
export async function processPDF(
  buffer: Buffer | Uint8Array,
  apiKey?: string
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

    // Select best text-layer extraction result
    let selectedAttempt = attempts
      .filter((attempt) => attempt.text.length > 0)
      .sort((a, b) => b.text.length - a.text.length)[0]

    // OCR fallback: if text-layer extraction yielded too little text AND we have an API key
    const bestTextLength = selectedAttempt?.text.length || 0
    if (bestTextLength < MIN_PRIMARY_EXTRACTION_CHARS && apiKey) {
      const pageCount = selectedAttempt?.pageCount || attempts[0]?.pageCount || 1
      console.log(
        `[PDF Processor] Text extraction yielded only ${bestTextLength} chars — triggering vision OCR fallback`
      )
      try {
        const ocrAttempt = await extractWithVisionOCR(toUint8Array(sourceBuffer), pageCount, apiKey)
        if (ocrAttempt.text.length > bestTextLength) {
          attempts.push(ocrAttempt)
          selectedAttempt = ocrAttempt
          console.log(`[PDF Processor] OCR produced ${ocrAttempt.text.length} chars — using OCR result`)
        }
      } catch (error) {
        console.warn("[PDF Processor] Vision OCR fallback failed:", error)
      }
    }

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
    } else if (selectedAttempt.method === "vision-ocr") {
      console.log("[PDF Processor] Using vision OCR extraction result")
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
