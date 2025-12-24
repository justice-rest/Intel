/**
 * Server-side PDF Export API
 *
 * Generates high-quality PDFs from markdown content using Puppeteer.
 * Uses Chrome's rendering engine for professional typography and layout.
 */

import { NextRequest, NextResponse } from "next/server"
import type { Browser, Page } from "puppeteer-core"

// Lazy-loaded modules
let chromium: typeof import("@sparticuz/chromium") | null = null
let puppeteerCore: typeof import("puppeteer-core") | null = null

/**
 * Lazy load puppeteer-core and @sparticuz/chromium
 */
async function loadPuppeteer() {
  if (!puppeteerCore || !chromium) {
    try {
      const chromiumModule = "@sparticuz/chromium"
      const puppeteerModule = "puppeteer-core"
      chromium = await import(chromiumModule)
      puppeteerCore = await import(puppeteerModule)
    } catch (error) {
      throw new Error(
        `Failed to load puppeteer-core or @sparticuz/chromium: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  return { chromium, puppeteerCore }
}

/**
 * Check if running in serverless environment
 */
function isServerless(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  )
}

/**
 * Create a browser instance for PDF generation
 */
async function createPdfBrowser(): Promise<Browser> {
  const { chromium: chr, puppeteerCore: pptr } = await loadPuppeteer()

  if (!chr || !pptr) {
    throw new Error("Failed to load puppeteer dependencies")
  }

  let executablePath: string

  if (isServerless()) {
    executablePath = await chr.default.executablePath()
  } else {
    const possiblePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ]

    const fs = await import("fs")
    executablePath =
      possiblePaths.find((p) => {
        try {
          return fs.existsSync(p)
        } catch {
          return false
        }
      }) || (await chr.default.executablePath())
  }

  const browser = await pptr.default.launch({
    executablePath,
    headless: true,
    args: isServerless()
      ? [...chr.default.args, "--disable-dev-shm-usage"]
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
        ],
    defaultViewport: { width: 1200, height: 1600 },
  })

  return browser
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Convert markdown to HTML with professional styling
 */
function markdownToHtml(markdown: string, title: string, date: string): string {
  let html = markdown

  // Handle code blocks first (before other transformations)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block${lang ? ` language-${lang}` : ""}"><code>${escapeHtml(code.trim())}</code></pre>`
  })

  // Handle inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Handle headings (order matters - longest match first)
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>")
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>")
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>")

  // Handle horizontal rules
  html = html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "<hr>")

  // Handle blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n")

  // Handle bold and italic (order matters)
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")

  // Handle links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  )

  // Handle tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split("|").map((cell: string) => cell.trim())
    if (cells.every((cell: string) => /^[-:]+$/.test(cell))) {
      return "<!-- table-separator -->"
    }
    return `<tr>${cells.map((cell: string) => `<td>${cell}</td>`).join("")}</tr>`
  })
  html = html.replace(
    /(<tr>[\s\S]*?<\/tr>)\n<!-- table-separator -->\n((?:<tr>[\s\S]*?<\/tr>\n?)+)/g,
    (_, header, body) => {
      const headerCells = header
        .replace(/<td>/g, "<th>")
        .replace(/<\/td>/g, "</th>")
      return `<table><thead>${headerCells}</thead><tbody>${body}</tbody></table>`
    }
  )

  // Handle unordered lists
  const ulRegex = /(?:^[-*+] .+$\n?)+/gm
  html = html.replace(ulRegex, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => {
        const content = line.replace(/^[-*+] /, "")
        return `<li>${content}</li>`
      })
      .join("")
    return `<ul>${items}</ul>`
  })

  // Handle ordered lists
  const olRegex = /(?:^\d+\. .+$\n?)+/gm
  html = html.replace(olRegex, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => {
        const content = line.replace(/^\d+\. /, "")
        return `<li>${content}</li>`
      })
      .join("")
    return `<ol>${items}</ol>`
  })

  // Handle paragraphs
  const lines = html.split("\n")
  const processedLines: string[] = []
  let paragraphContent: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const isBlockElement =
      /^<(h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|pre|blockquote|hr|div)/.test(
        trimmed
      )
    const isEndBlockElement =
      /^<\/(h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|pre|blockquote|div)>/.test(
        trimmed
      )
    const isEmpty = trimmed === ""

    if (isBlockElement || isEmpty || isEndBlockElement) {
      if (paragraphContent.length > 0) {
        processedLines.push(`<p>${paragraphContent.join(" ")}</p>`)
        paragraphContent = []
      }
      if (!isEmpty) {
        processedLines.push(line)
      }
    } else if (trimmed.startsWith("<!--")) {
      processedLines.push(line)
    } else {
      paragraphContent.push(trimmed)
    }
  }

  if (paragraphContent.length > 0) {
    processedLines.push(`<p>${paragraphContent.join(" ")}</p>`)
  }

  html = processedLines.join("\n")
  html = html.replace(/<p>\s*<\/p>/g, "")

  return generateFullHtml(html, title, date)
}

/**
 * Generate full HTML document with styling
 */
function generateFullHtml(content: string, title: string, date: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --color-primary: #0f172a;
      --color-secondary: #475569;
      --color-accent: #00A5E4;
      --color-accent-light: #e0f2fe;
      --color-text: #334155;
      --color-muted: #64748b;
      --color-border: #e2e8f0;
      --color-bg: #ffffff;
      --color-card: #f8fafc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      font-family: var(--font-body);
      font-size: 10.5pt;
      font-weight: 400;
      line-height: 1.65;
      color: var(--color-text);
      -webkit-font-smoothing: antialiased;
    }

    body {
      max-width: 7.5in;
      margin: 0 auto;
      padding: 0.6in 0.75in;
      background: var(--color-bg);
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 2em;
      padding-bottom: 1.5em;
      border-bottom: 2px solid var(--color-border);
    }

    .logo {
      font-size: 24pt;
      font-weight: 700;
      color: var(--color-accent);
      letter-spacing: -0.02em;
      margin-bottom: 0.75em;
    }

    .header .date {
      font-size: 9pt;
      font-weight: 500;
      color: var(--color-muted);
      margin-bottom: 0.5em;
      letter-spacing: 0.02em;
    }

    .header h1 {
      font-size: 22pt;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.03em;
      line-height: 1.2;
      color: var(--color-primary);
    }

    /* Typography */
    h1 { font-size: 18pt; font-weight: 700; color: var(--color-primary); margin: 1.5em 0 0.6em; letter-spacing: -0.02em; line-height: 1.25; }
    h2 { font-size: 14pt; font-weight: 700; color: var(--color-primary); margin: 1.75em 0 0.6em; padding-bottom: 0.4em; border-bottom: 2px solid var(--color-accent); }
    h3 { font-size: 11pt; font-weight: 600; color: var(--color-primary); margin: 1.25em 0 0.5em; }
    h4 { font-size: 10.5pt; font-weight: 600; color: var(--color-primary); margin: 1em 0 0.4em; }

    p { margin: 0 0 0.9em; }
    strong { font-weight: 600; color: var(--color-primary); }
    em { font-style: italic; }
    a { color: var(--color-accent); text-decoration: none; }

    /* Lists */
    ul, ol { margin: 0.5em 0 1em 1.5em; padding: 0; }
    li { margin: 0.3em 0; line-height: 1.6; }
    li::marker { color: var(--color-muted); }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 1em 0 1.5em; font-size: 9.5pt; }
    th, td { padding: 0.6em 0.75em; text-align: left; border: 1px solid var(--color-border); }
    th { font-weight: 600; background: var(--color-card); color: var(--color-primary); }
    tr:nth-child(even) td { background: var(--color-card); }

    /* Code */
    .code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1em 1.25em;
      margin: 1em 0 1.5em;
      border-radius: 8px;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 9pt;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .inline-code {
      background: var(--color-card);
      color: var(--color-primary);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 0.9em;
    }

    /* Blockquote */
    blockquote {
      border-left: 4px solid var(--color-accent);
      margin: 1em 0 1.5em;
      padding: 0.75em 1em;
      background: var(--color-accent-light);
      color: var(--color-secondary);
      font-style: italic;
      border-radius: 0 6px 6px 0;
    }
    blockquote p { margin: 0; }

    hr { border: none; border-top: 1px solid var(--color-border); margin: 1.5em 0; }

    /* Footer */
    .footer {
      margin-top: 3em;
      padding-top: 1em;
      border-top: 1px solid var(--color-border);
      font-size: 8.5pt;
      color: var(--color-muted);
      text-align: center;
    }

    /* Print styles */
    @page { size: Letter; margin: 0.5in; }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      h1, h2, h3, h4, table, ul, ol, blockquote, .code-block, p { break-inside: avoid; page-break-inside: avoid; }
      h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
      p { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Rōmy</div>
    <div class="date">${escapeHtml(date)}</div>
    <h1>${escapeHtml(title)}</h1>
  </div>

  <div class="content">
    ${content}
  </div>

  <div class="footer">
    <p>Generated by Rōmy &bull; intel.getromy.app</p>
    <p style="font-size: 8pt; margin-top: 0.4em;">This report contains research based on publicly available information.</p>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  let browser: Browser | null = null
  let page: Page | null = null

  try {
    const body = await request.json()
    const { content, title, date } = body

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    // Generate HTML from markdown
    const html = markdownToHtml(
      content,
      title || "Prospect Report",
      date ||
        new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
    )

    // Create browser and page
    browser = await createPdfBrowser()
    page = await browser.newPage()

    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready)

    // Small delay for final rendering
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    })

    // Generate filename
    const sanitizedTitle = (title || "report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50)

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `romy-${sanitizedTitle}-${dateStr}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("[ExportPDF] Error generating PDF:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate PDF",
      },
      { status: 500 }
    )
  } finally {
    if (page) {
      try {
        await page.close()
      } catch {
        // Ignore
      }
    }
    if (browser) {
      try {
        await browser.close()
      } catch {
        // Ignore
      }
    }
  }
}
