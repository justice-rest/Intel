/**
 * Server-side PDF Export API
 *
 * Generates high-quality PDFs from markdown content using Puppeteer.
 * Uses Chrome's rendering engine for professional typography and layout.
 */

import { NextRequest, NextResponse } from "next/server"
import type { Browser, Page } from "puppeteer-core"
import { createClient } from "@/lib/supabase/server"
import {
  toBrandingSettings,
  type BrandingSettings,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
  HEX_COLOR_REGEX,
} from "@/lib/pdf-branding"
import { hasPaidPlan, isAutumnEnabled } from "@/lib/subscription/autumn-client"

// Lazy-loaded modules
let chromium: typeof import("@sparticuz/chromium") | null = null
let puppeteerCore: typeof import("puppeteer-core") | null = null

/**
 * Lazy load puppeteer-core and @sparticuz/chromium
 */
async function loadPuppeteer() {
  if (!puppeteerCore || !chromium) {
    try {
      // Use direct imports - webpack needs string literals
      chromium = await import("@sparticuz/chromium")
      puppeteerCore = await import("puppeteer-core")
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

// Logo caching for performance
let cachedLogoBase64: string | null = null

/**
 * Get the Rōmy logo as base64 data URI
 */
function getLogoBase64(): string {
  if (cachedLogoBase64) {
    return cachedLogoBase64
  }

  try {
    const path = require("path")
    const fs = require("fs")
    const logoPath = path.join(process.cwd(), "public", "BrandmarkRōmy.png")
    const logoBuffer = fs.readFileSync(logoPath)
    cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`
    return cachedLogoBase64
  } catch {
    // Fallback: return empty string if logo can't be loaded
    console.warn("[ExportPDF] Could not load logo, using fallback")
    return ""
  }
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
function markdownToHtml(
  markdown: string,
  title: string,
  date: string,
  branding?: BrandingSettings
): string {
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

  return generateFullHtml(html, title, date, branding)
}

/**
 * Sanitize color for CSS (defense-in-depth)
 */
function sanitizeColor(color: string | undefined, defaultColor: string): string {
  if (!color) return defaultColor
  if (HEX_COLOR_REGEX.test(color)) return color
  console.warn(`[ExportPDF] Invalid color "${color}", using default`)
  return defaultColor
}

/**
 * Generate full HTML document with styling
 */
function generateFullHtml(
  content: string,
  title: string,
  date: string,
  branding?: BrandingSettings
): string {
  // Use custom branding or defaults
  const primaryColor = sanitizeColor(branding?.primaryColor, DEFAULT_PRIMARY_COLOR)
  const accentColor = sanitizeColor(branding?.accentColor, DEFAULT_ACCENT_COLOR)
  const logoBase64 = branding?.logoBase64 || getLogoBase64()
  const hideDefaultFooter = branding?.hideDefaultFooter || false
  const customFooterText = branding?.customFooterText || null
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
      --color-primary: ${primaryColor};
      --color-secondary: #475569;
      --color-accent: ${accentColor};
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
      margin-bottom: 0.75em;
    }

    .logo img {
      height: 36px;
      width: auto;
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
    <div class="logo">${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : '<span style="font-size: 24pt; font-weight: 700; color: var(--color-accent);">Rōmy</span>'}</div>
    <div class="date">${escapeHtml(date)}</div>
    <h1>${escapeHtml(title)}</h1>
  </div>

  <div class="content">
    ${content}
  </div>

  <div class="footer">
    ${!hideDefaultFooter ? `<p>Generated by Rōmy &bull; intel.getromy.app</p>
    <p style="font-size: 8pt; margin-top: 0.4em;">This report contains research based on publicly available information.</p>` : ''}
    ${customFooterText ? `<p style="font-size: 8pt; ${hideDefaultFooter ? '' : 'margin-top: 0.6em;'}">${escapeHtml(customFooterText)}</p>` : ''}
    ${hideDefaultFooter && !customFooterText ? '<p style="font-size: 8pt; color: #94a3b8;">&nbsp;</p>' : ''}
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

    // Fetch user's custom branding settings (only for Pro/Scale users)
    let branding: BrandingSettings | undefined
    try {
      const supabase = await createClient()
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          // Only fetch branding if user has Pro/Scale plan
          // Downgraded users get default branding
          const hasAccess = isAutumnEnabled() ? await hasPaidPlan(user.id) : true

          if (hasAccess) {
            const { data: brandingData, error: brandingError } = await supabase
              .from("pdf_branding")
              .select("*")
              .eq("user_id", user.id)
              .single() as { data: {
                id: string
                user_id: string
                primary_color: string | null
                accent_color: string | null
                logo_url: string | null
                logo_base64: string | null
                logo_content_type: string | null
                hide_default_footer: boolean | null
                custom_footer_text: string | null
                created_at: string | null
                updated_at: string | null
              } | null; error: any }

            if (!brandingError && brandingData) {
              console.log("[ExportPDF] Found custom branding for user")
              branding = toBrandingSettings({
                id: brandingData.id,
                userId: brandingData.user_id,
                primaryColor: brandingData.primary_color ?? "",
                accentColor: brandingData.accent_color ?? "",
                logoUrl: brandingData.logo_url,
                logoBase64: brandingData.logo_base64,
                logoContentType: brandingData.logo_content_type,
                hideDefaultFooter: brandingData.hide_default_footer ?? false,
                customFooterText: brandingData.custom_footer_text,
                createdAt: brandingData.created_at ?? "",
                updatedAt: brandingData.updated_at ?? "",
              })
            }
          } else {
            console.log("[ExportPDF] User does not have Pro/Scale plan, using default branding")
          }
        }
      }
    } catch (error) {
      console.warn("[ExportPDF] Could not fetch branding:", error)
      // Continue without branding
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
        }),
      branding
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

    // Convert Uint8Array to ArrayBuffer for TypeScript 5.x compatibility
    // Puppeteer returns Uint8Array with regular ArrayBuffer, so cast is safe
    const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: "application/pdf" })
    return new NextResponse(blob, {
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
