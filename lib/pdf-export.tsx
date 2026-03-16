"use client"

/**
 * Export Client
 *
 * Exports markdown content to high-quality PDFs using server-side Puppeteer,
 * or downloads the raw markdown as a .md file.
 *
 * PDF benefits over client-side react-pdf/renderer:
 * - Professional typography with Inter font
 * - Proper page breaks (no word splitting)
 * - Consistent spacing and margins
 * - Full CSS support including print media queries
 * - Background colors and gradients render correctly
 */

type ExportOptions = {
  title: string
  date: string
  logoSrc?: string // Kept for backward compatibility but handled server-side
}

/** Truncate overly long titles (matches share page display logic) */
function formatExportTitle(title: string): string {
  if (title.length <= 80) return title
  const truncated = title.substring(0, 80)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated) + "..."
}

/**
 * Generate a sanitized filename base from a title
 */
function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

/**
 * Export markdown content as a .md file download
 *
 * @param content - Markdown content to export
 * @param options - Export options including title and date
 */
export async function exportToMarkdown(
  content: string,
  options: ExportOptions
): Promise<void> {
  const { title, date } = options
  const displayTitle = formatExportTitle(title)

  // Build the markdown file with a header
  const markdownContent = `# ${displayTitle}\n\n*${date}*\n\n---\n\n${content}\n`

  const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" })
  const sanitizedTitle = sanitizeFilename(title)
  const dateStr = new Date().toISOString().split("T")[0]
  const filename = `romy-${sanitizedTitle}-${dateStr}.md`

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export markdown content to PDF
 *
 * This function sends the content to the server for high-quality PDF generation
 * using Puppeteer with Chrome's rendering engine.
 *
 * @param content - Markdown content to export
 * @param options - Export options including title and date
 * @returns Promise that resolves when the PDF is downloaded
 */
export async function exportToPdf(
  content: string,
  options: ExportOptions
): Promise<void> {
  const { title: rawTitle, date } = options
  const title = formatExportTitle(rawTitle)

  try {
    // Call server-side PDF generation
    const response = await fetch("/api/export-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        title,
        date,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to generate PDF" }))
      throw new Error(error.error || "Failed to generate PDF")
    }

    // Get the PDF blob
    const blob = await response.blob()

    // Extract filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = "romy-report.pdf"
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
      if (match) {
        filename = match[1]
      }
    } else {
      // Generate filename from title
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 50)
      filename = `romy-${sanitizedTitle}-${new Date().toISOString().split("T")[0]}.pdf`
    }

    // Download the file
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("[exportToPdf] Error:", error)
    throw error
  }
}
