"use client"

/**
 * PDF Export Client
 *
 * Exports markdown content to high-quality PDFs using server-side Puppeteer.
 * Sends content to /api/export-pdf which renders HTML with proper typography,
 * spacing, and page breaks, then converts to PDF using Chrome's rendering engine.
 *
 * Benefits over client-side react-pdf/renderer:
 * - Professional typography with Inter font
 * - Proper page breaks (no word splitting)
 * - Consistent spacing and margins
 * - Full CSS support including print media queries
 * - Background colors and gradients render correctly
 */

type ExportToPdfOptions = {
  title: string
  date: string
  logoSrc?: string // Kept for backward compatibility but handled server-side
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
  options: ExportToPdfOptions
): Promise<void> {
  const { title, date } = options

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
