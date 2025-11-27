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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    height: 40,
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  date: {
    fontSize: 10,
    color: "#666666",
    textAlign: "center",
  },
  content: {
    marginTop: 10,
  },
  paragraph: {
    marginBottom: 10,
  },
  heading1: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 4,
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
  code: {
    fontFamily: "Courier",
    backgroundColor: "#f5f5f5",
    padding: 2,
    fontSize: 10,
  },
  codeBlock: {
    fontFamily: "Courier",
    backgroundColor: "#f5f5f5",
    padding: 10,
    marginVertical: 8,
    fontSize: 9,
    borderRadius: 4,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 10,
  },
  listBullet: {
    width: 15,
  },
  listContent: {
    flex: 1,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#cccccc",
    paddingLeft: 10,
    marginVertical: 8,
    color: "#555555",
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline",
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginVertical: 15,
  },
  table: {
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontFamily: "Helvetica-Bold",
  },
  tableCell: {
    padding: 6,
    flex: 1,
    fontSize: 10,
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
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push({ type: "codeBlock", content: codeLines.join("\n") })
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

    // Paragraph (collect consecutive non-empty lines)
    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|_{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i])
      i++
    }
    if (paragraphLines.length > 0) {
      nodes.push({ type: "paragraph", content: paragraphLines.join(" ") })
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

    // Link
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

    // Plain text (up to next special character or end)
    const nextSpecial = remaining.search(/[\*`\[]/)
    if (nextSpecial === -1) {
      elements.push(<Text key={key++}>{remaining}</Text>)
      break
    } else if (nextSpecial === 0) {
      // Special char but no match - treat as plain text
      elements.push(<Text key={key++}>{remaining[0]}</Text>)
      remaining = remaining.slice(1)
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
            : styles.heading3
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
                  : styles.tableRow
              }
            >
              {row.map((cell, cellIdx) => (
                <Text key={cellIdx} style={styles.tableCell}>
                  {renderInlineText(cell)}
                </Text>
              ))}
            </View>
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
        <View style={styles.header}>
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <View style={styles.content}>
          {nodes.map((node, index) => renderNode(node, index))}
        </View>
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
