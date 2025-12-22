"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Link,
  Font,
} from "@react-pdf/renderer"

// Register a monospace font for code blocks
Font.register({
  family: "Courier",
  src: "https://fonts.gstatic.com/s/courierprime/v9/u-450q2lgwslOqpF_6gQ8kELWwZjW-c.ttf",
})

// Colors matching the share page design
const colors = {
  foreground: "#0a0a0a",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#2563eb",
  background: "#ffffff",
  codeBackground: "#f3f4f6",
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    paddingTop: 40,
    paddingBottom: 60,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.6,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  // Header section - matching share page
  header: {
    marginBottom: 40,
  },
  // Full-width brandmark at top
  brandmarkContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  brandmark: {
    width: "100%",
    maxWidth: 200,
    height: "auto",
    objectFit: "contain",
  },
  // Date - matching share page: text-sm font-medium centered
  dateContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  date: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.foreground,
    textAlign: "center",
  },
  // Title - matching share page: text-4xl font-medium tracking-tight centered
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textAlign: "center",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  // Subtitle area
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  // Divider
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 16,
  },
  // Content area
  content: {
    marginTop: 24,
  },
  // Typography - matching prose styling
  paragraph: {
    marginBottom: 14,
    lineHeight: 1.7,
  },
  heading1: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginTop: 28,
    marginBottom: 12,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  heading2: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 24,
    marginBottom: 10,
    color: colors.foreground,
  },
  heading3: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
    color: colors.foreground,
  },
  heading4: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 4,
    color: colors.foreground,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  italic: {
    fontFamily: "Helvetica-Oblique",
  },
  boldItalic: {
    fontFamily: "Helvetica-BoldOblique",
  },
  // Inline code
  code: {
    fontFamily: "Courier",
    backgroundColor: colors.codeBackground,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontSize: 10,
    borderRadius: 2,
  },
  // Code block
  codeBlock: {
    fontFamily: "Courier",
    backgroundColor: colors.codeBackground,
    padding: 14,
    marginVertical: 12,
    fontSize: 9,
    borderRadius: 6,
    lineHeight: 1.5,
  },
  // Lists
  listItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  listBullet: {
    width: 20,
    color: colors.muted,
  },
  listContent: {
    flex: 1,
    lineHeight: 1.6,
  },
  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: 16,
    marginVertical: 12,
    color: colors.muted,
    fontStyle: "italic",
  },
  // Links - styled for better visibility
  link: {
    color: colors.accent,
    textDecoration: "underline",
  },
  // Horizontal rule
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: 20,
  },
  // Tables
  table: {
    marginVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowLast: {
    flexDirection: "row",
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: colors.codeBackground,
  },
  tableCell: {
    padding: 8,
    flex: 1,
    fontSize: 10,
  },
  tableCellHeader: {
    padding: 8,
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  // Mermaid diagrams
  mermaidContainer: {
    marginVertical: 14,
    backgroundColor: "#f0f4f8",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mermaidHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mermaidLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.foreground,
  },
  mermaidNote: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 3,
  },
  mermaidCode: {
    fontFamily: "Courier",
    fontSize: 9,
    color: colors.foreground,
    lineHeight: 1.5,
  },
  // Line blocks
  lineBlock: {
    marginBottom: 12,
  },
  lineBlockLine: {
    marginBottom: 3,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 9,
    color: colors.muted,
  },
})

type MarkdownNode = {
  type: string
  content?: string
  children?: MarkdownNode[]
  level?: number
  ordered?: boolean
  href?: string
  rows?: string[][]
  language?: string
  lines?: string[]
}

// Simple markdown parser
function parseMarkdown(text: string): MarkdownNode[] {
  const lines = text.split("\n")
  const nodes: MarkdownNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith("```")) {
      const language = line.slice(3).trim().toLowerCase()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      const content = codeLines.join("\n")

      if (language === "mermaid") {
        nodes.push({ type: "mermaid", content, language })
      } else {
        nodes.push({ type: "codeBlock", content, language })
      }
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      nodes.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      nodes.push({ type: "hr" })
      i++
      continue
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""))
        i++
      }
      nodes.push({ type: "blockquote", content: quoteLines.join("\n") })
      continue
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""))
        i++
      }
      nodes.push({
        type: "list",
        ordered: false,
        children: items.map((item) => ({ type: "listItem", content: item })),
      })
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""))
        i++
      }
      nodes.push({
        type: "list",
        ordered: true,
        children: items.map((item) => ({ type: "listItem", content: item })),
      })
      continue
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && /^\|?[-:| ]+\|?$/.test(lines[i + 1])) {
      const tableRows: string[][] = []
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "")
        if (!/^[-:| ]+$/.test(lines[i])) {
          tableRows.push(row)
        }
        i++
      }
      nodes.push({ type: "table", rows: tableRows })
      continue
    }

    // Empty line
    if (line.trim() === "") {
      i++
      continue
    }

    // Paragraph
    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|_{3,}|\*{3,})$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && /^\|?[-:| ]+\|?$/.test(lines[i + 1]))
    ) {
      paragraphLines.push(lines[i])
      i++
    }
    if (paragraphLines.length > 0) {
      const hasMarkdownLineBreaks = paragraphLines.some(line => /\s{2,}$/.test(line))

      if (hasMarkdownLineBreaks) {
        nodes.push({
          type: "lineBlock",
          lines: paragraphLines.map(l => l.trimEnd())
        })
      } else {
        nodes.push({ type: "paragraph", content: paragraphLines.join(" ") })
      }
    }
  }

  return nodes
}

// Render inline formatting (bold, italic, code, links)
function renderInlineText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold + Italic
    let match = remaining.match(/^\*\*\*(.+?)\*\*\*/)
    if (match) {
      elements.push(
        <Text key={key++} style={styles.boldItalic}>
          {match[1]}
        </Text>
      )
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Bold
    match = remaining.match(/^\*\*(.+?)\*\*/)
    if (match) {
      elements.push(
        <Text key={key++} style={styles.bold}>
          {match[1]}
        </Text>
      )
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Italic
    match = remaining.match(/^\*(.+?)\*/)
    if (match) {
      elements.push(
        <Text key={key++} style={styles.italic}>
          {match[1]}
        </Text>
      )
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Inline code
    match = remaining.match(/^`([^`]+)`/)
    if (match) {
      elements.push(
        <Text key={key++} style={styles.code}>
          {match[1]}
        </Text>
      )
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Markdown link: [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      elements.push(
        <Link key={key++} src={match[2]} style={styles.link}>
          {match[1]}
        </Link>
      )
      remaining = remaining.slice(match[0].length)
      continue
    }

    // Plain URL detection (for links not in markdown format)
    match = remaining.match(/^(https?:\/\/[^\s<>\[\]()]+)/)
    if (match) {
      const url = match[1]
      // Clean up trailing punctuation that might be captured
      const cleanUrl = url.replace(/[.,;:!?)]+$/, "")
      const trailingChars = url.slice(cleanUrl.length)
      elements.push(
        <Link key={key++} src={cleanUrl} style={styles.link}>
          {cleanUrl}
        </Link>
      )
      if (trailingChars) {
        elements.push(<Text key={key++}>{trailingChars}</Text>)
      }
      remaining = remaining.slice(url.length)
      continue
    }

    // Plain text (up to next special character or end)
    const nextSpecial = remaining.search(/[\*`\[h]/)
    if (nextSpecial === -1) {
      elements.push(<Text key={key++}>{remaining}</Text>)
      break
    } else if (nextSpecial === 0) {
      // Check if it's an http link
      if (remaining.startsWith("http")) {
        // This is handled above, but if we get here, just output the character
        elements.push(<Text key={key++}>{remaining[0]}</Text>)
        remaining = remaining.slice(1)
      } else {
        // Special char but no match - treat as plain text
        elements.push(<Text key={key++}>{remaining[0]}</Text>)
        remaining = remaining.slice(1)
      }
    } else {
      elements.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>)
      remaining = remaining.slice(nextSpecial)
    }
  }

  return elements
}

// Render a markdown node to PDF components
function renderNode(node: MarkdownNode, index: number): React.ReactNode {
  switch (node.type) {
    case "heading":
      const headingStyle =
        node.level === 1
          ? styles.heading1
          : node.level === 2
            ? styles.heading2
            : node.level === 3
              ? styles.heading3
              : styles.heading4
      return (
        <Text key={index} style={headingStyle}>
          {node.content}
        </Text>
      )

    case "paragraph":
      return (
        <Text key={index} style={styles.paragraph}>
          {renderInlineText(node.content || "")}
        </Text>
      )

    case "codeBlock":
      return (
        <View key={index} style={styles.codeBlock}>
          <Text>{node.content}</Text>
        </View>
      )

    case "list":
      return (
        <View key={index}>
          {node.children?.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.listBullet}>
                {node.ordered ? `${idx + 1}.` : "•"}
              </Text>
              <Text style={styles.listContent}>
                {renderInlineText(item.content || "")}
              </Text>
            </View>
          ))}
        </View>
      )

    case "blockquote":
      return (
        <View key={index} style={styles.blockquote}>
          <Text>{renderInlineText(node.content || "")}</Text>
        </View>
      )

    case "hr":
      return <View key={index} style={styles.hr} />

    case "table":
      return (
        <View key={index} style={styles.table}>
          {node.rows?.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={
                rowIdx === 0
                  ? [styles.tableRow, styles.tableHeader]
                  : rowIdx === (node.rows?.length || 0) - 1
                    ? styles.tableRowLast
                    : styles.tableRow
              }
            >
              {row.map((cell, cellIdx) => (
                <Text
                  key={cellIdx}
                  style={rowIdx === 0 ? styles.tableCellHeader : styles.tableCell}
                >
                  {renderInlineText(cell)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )

    case "mermaid":
      return (
        <View key={index} style={styles.mermaidContainer}>
          <View style={styles.mermaidHeader}>
            <Text style={styles.mermaidLabel}>Diagram</Text>
            <Text style={styles.mermaidNote}>View in browser for rendered visualization</Text>
          </View>
          <Text style={styles.mermaidCode}>{node.content}</Text>
        </View>
      )

    case "lineBlock":
      return (
        <View key={index} style={styles.lineBlock}>
          {node.lines?.map((line, lineIdx) => (
            <Text key={lineIdx} style={styles.lineBlockLine}>
              {renderInlineText(line)}
            </Text>
          ))}
        </View>
      )

    default:
      return null
  }
}

type PdfDocumentProps = {
  title: string
  date: string
  content: string
  logoSrc: string
}

function PdfDocument({ title, date, content, logoSrc }: PdfDocumentProps) {
  const nodes = parseMarkdown(content)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header section - matching share page layout */}
        <View style={styles.header}>
          {/* Full-width brandmark at top */}
          <View style={styles.brandmarkContainer}>
            <Image src={logoSrc} style={styles.brandmark} />
          </View>

          {/* Date - centered like share page */}
          <View style={styles.dateContainer}>
            <Text style={styles.date}>{date}</Text>
          </View>

          {/* Title - large and centered like share page */}
          <Text style={styles.title}>{title}</Text>

          {/* Divider */}
          <View style={styles.headerDivider} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {nodes.map((node, index) => renderNode(node, index))}
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generated by Rōmy • intel.getromy.app
        </Text>
      </Page>
    </Document>
  )
}

type ExportToPdfOptions = {
  title: string
  date: string
  logoSrc: string
}

export async function exportToPdf(
  content: string,
  options: ExportToPdfOptions
): Promise<void> {
  const { title, date, logoSrc } = options

  // Generate the PDF blob
  const blob = await pdf(
    <PdfDocument title={title} date={date} content={content} logoSrc={logoSrc} />
  ).toBlob()

  // Generate filename
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)

  const filename = `romy-${sanitizedTitle}-${new Date().toISOString().split("T")[0]}.pdf`

  // Download the file
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
