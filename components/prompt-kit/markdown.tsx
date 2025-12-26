"use client"

import { LinkMarkdown } from "@/app/components/chat/link-markdown"
import { cn } from "@/lib/utils"
import { lazy, memo, Suspense, useId, useMemo } from "react"
import { Streamdown, type StreamdownProps } from "streamdown"
import type { BundledTheme } from "shiki"
import { ButtonCopy } from "../common/button-copy"
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "../prompt-kit/code-block"

// Lazy load mermaid renderer to avoid bundle bloat
const MermaidDiagram = lazy(() => import("@/components/prompt-kit/mermaid-diagram"))

// ============================================================================
// CONFIDENCE TAG STYLING
// Converts [Verified], [Unverified], [Corroborated], [Estimated] into styled badges
// ============================================================================

const CONFIDENCE_TAG_PATTERNS: Array<{
  pattern: RegExp
  className: string
  label: string
}> = [
  {
    pattern: /\[Verified\]/g,
    className: "confidence-tag confidence-verified",
    label: "Verified",
  },
  {
    pattern: /\[Corroborated\]/g,
    className: "confidence-tag confidence-corroborated",
    label: "Corroborated",
  },
  {
    pattern: /\[Unverified[^\]]*\]/g,
    className: "confidence-tag confidence-unverified",
    label: "Unverified",
  },
  {
    pattern: /\[Estimated[^\]]*\]/g,
    className: "confidence-tag confidence-estimated",
    label: "Estimated",
  },
]

/**
 * Preprocess markdown to convert confidence tags into styled HTML spans
 */
function preprocessConfidenceTags(content: string): string {
  let processed = content

  // Replace each confidence tag pattern with a styled span
  for (const { pattern, className } of CONFIDENCE_TAG_PATTERNS) {
    processed = processed.replace(pattern, (match) => {
      // Extract the label text from the match (e.g., "[Verified]" -> "Verified")
      const label = match.slice(1, -1) // Remove [ and ]
      return `<span class="${className}">${label}</span>`
    })
  }

  return processed
}

// Re-export the Components type for consumers
type Components = StreamdownProps["components"]

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Components
  isAnimating?: boolean
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Components = {
  code: function CodeComponent({ className, children, node, ...props }) {
    // Determine if inline based on whether there's a parent <pre> element
    // In Streamdown/rehype, code blocks are wrapped in <pre><code>
    // We detect this by checking if node's parent is a pre element
    const isInline = !node?.position || (
      node?.position?.start.line === node?.position?.end.line &&
      !className?.includes("language-")
    )

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)
    const codeString = typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.join("")
        : String(children || "")

    // Handle mermaid diagrams separately
    if (language === "mermaid") {
      return (
        <Suspense
          fallback={
            <div className="my-4 flex items-center justify-center rounded-xl border p-8">
              <span className="text-sm text-muted-foreground">Rendering diagram...</span>
            </div>
          }
        >
          <MermaidDiagram chart={codeString} />
        </Suspense>
      )
    }

    // Regular code blocks with custom styling
    return (
      <CodeBlock className={className}>
        <CodeBlockGroup className="flex h-9 items-center justify-between px-4">
          <div className="text-muted-foreground py-1 pr-2 font-mono text-xs">
            {language}
          </div>
        </CodeBlockGroup>
        <div className="sticky top-16 lg:top-0">
          <div className="absolute right-0 bottom-0 flex h-9 items-center pr-1.5">
            <ButtonCopy code={codeString} />
          </div>
        </div>
        <CodeBlockCode code={codeString} language={language} />
      </CodeBlock>
    )
  },
  a: function AComponent({ href, children, ...props }) {
    if (!href) return <span {...props}>{children}</span>

    return (
      <LinkMarkdown href={href} {...props}>
        {children}
      </LinkMarkdown>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

function MarkdownComponent({
  children,
  id,
  className,
  components,
  isAnimating = false,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId

  // Merge custom components with defaults
  const mergedComponents = useMemo(() => {
    if (!components) return INITIAL_COMPONENTS
    return { ...INITIAL_COMPONENTS, ...components }
  }, [components])

  // Shiki theme for syntax highlighting (light/dark)
  const shikiTheme: [BundledTheme, BundledTheme] = useMemo(() => {
    return ["github-light", "github-dark"]
  }, [])

  // Preprocess content to style confidence tags
  const processedContent = useMemo(() => {
    return preprocessConfidenceTags(children)
  }, [children])

  return (
    <div className={className} key={blockId}>
      {/* Inline styles for confidence tags */}
      <style jsx global>{`
        .confidence-tag {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          margin: 0 0.125rem;
          white-space: nowrap;
        }

        .confidence-verified {
          background-color: rgba(34, 197, 94, 0.15);
          color: rgb(22, 163, 74);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .dark .confidence-verified {
          background-color: rgba(34, 197, 94, 0.2);
          color: rgb(74, 222, 128);
          border: 1px solid rgba(34, 197, 94, 0.4);
        }

        .confidence-corroborated {
          background-color: rgba(59, 130, 246, 0.15);
          color: rgb(37, 99, 235);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .dark .confidence-corroborated {
          background-color: rgba(59, 130, 246, 0.2);
          color: rgb(96, 165, 250);
          border: 1px solid rgba(59, 130, 246, 0.4);
        }

        .confidence-unverified {
          background-color: rgba(249, 115, 22, 0.15);
          color: rgb(234, 88, 12);
          border: 1px solid rgba(249, 115, 22, 0.3);
        }

        .dark .confidence-unverified {
          background-color: rgba(249, 115, 22, 0.2);
          color: rgb(251, 146, 60);
          border: 1px solid rgba(249, 115, 22, 0.4);
        }

        .confidence-estimated {
          background-color: rgba(168, 85, 247, 0.15);
          color: rgb(147, 51, 234);
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        .dark .confidence-estimated {
          background-color: rgba(168, 85, 247, 0.2);
          color: rgb(192, 132, 252);
          border: 1px solid rgba(168, 85, 247, 0.4);
        }
      `}</style>
      <Streamdown
        components={mergedComponents}
        shikiTheme={shikiTheme}
        isAnimating={isAnimating}
        controls={{
          table: true,
          code: false, // We use our own copy button
          mermaid: true,
        }}
        mode="streaming"
        parseIncompleteMarkdown={true}
      >
        {processedContent}
      </Streamdown>
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
