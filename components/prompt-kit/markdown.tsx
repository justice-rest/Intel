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

/**
 * Tooltip definitions for each confidence tag type
 */
const CONFIDENCE_TOOLTIPS = {
  verified: "Confirmed via official records (county assessor, SEC, FEC, etc.)",
  corroborated: "Supported by multiple independent sources",
  unverified: "Single source only—treat with caution",
  estimated: "Calculated from available data using industry formulas",
}

/**
 * Strip model-specific artifacts that shouldn't be rendered
 * (e.g., Grok's </grok:render> tags)
 */
function stripModelArtifacts(content: string): string {
  return content
    // Remove Grok render tags
    .replace(/<\/?grok:[^>]*>/gi, '')
    // Remove any other model-specific XML-like tags (claude:, gemini:, etc.)
    .replace(/<\/?(?:claude|gemini|anthropic|openai):[^>]*>/gi, '')
}

/**
 * Preprocess markdown to convert confidence tags into styled HTML spans with tooltips
 *
 * Handles patterns like:
 * - [Verified] → badge with tooltip
 * - [Corroborated] → badge with tooltip
 * - [Unverified] or [Unverified - reason] → badge "Unverified" + text "- reason"
 * - [Estimated] or [Estimated - methodology] → badge "Estimated" + text "- methodology"
 */
function preprocessConfidenceTags(content: string): string {
  // First strip any model-specific artifacts
  let processed = stripModelArtifacts(content)

  // [Verified] or [Verified - source] → badge only (source info usually redundant with link)
  processed = processed.replace(
    /\[Verified([^\]]*)\]/g,
    `<span class="confidence-tag confidence-verified" data-tooltip="${CONFIDENCE_TOOLTIPS.verified}">Verified</span>`
  )

  // [Corroborated] or [Corroborated - source] → badge only
  processed = processed.replace(
    /\[Corroborated([^\]]*)\]/g,
    `<span class="confidence-tag confidence-corroborated" data-tooltip="${CONFIDENCE_TOOLTIPS.corroborated}">Corroborated</span>`
  )

  // [Unverified] or [Unverified - reason] → badge + reason text
  processed = processed.replace(
    /\[Unverified([^\]]*)\]/g,
    (_, extra) => {
      const badge = `<span class="confidence-tag confidence-unverified" data-tooltip="${CONFIDENCE_TOOLTIPS.unverified}">Unverified</span>`
      // Keep reason text if provided (e.g., "- Single Source")
      const cleanExtra = extra?.trim().replace(/^-\s*/, '')
      return cleanExtra ? `${badge}<span class="confidence-detail"> - ${cleanExtra}</span>` : badge
    }
  )

  // [Estimated] or [Estimated - methodology] → badge + methodology text
  processed = processed.replace(
    /\[Estimated([^\]]*)\]/g,
    (_, extra) => {
      const badge = `<span class="confidence-tag confidence-estimated" data-tooltip="${CONFIDENCE_TOOLTIPS.estimated}">Estimated</span>`
      // Keep methodology text if provided
      const cleanExtra = extra?.trim().replace(/^-\s*/, '')
      return cleanExtra ? `${badge}<span class="confidence-detail"> - ${cleanExtra}</span>` : badge
    }
  )

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

        /* Detail text after badges (methodology, reasons, etc.) */
        .confidence-detail {
          font-size: 0.8rem;
          color: rgb(107, 114, 128);
          margin-left: 0.125rem;
        }

        .dark .confidence-detail {
          color: rgb(156, 163, 175);
        }

        /* CSS-only tooltip */
        .confidence-tag[data-tooltip] {
          position: relative;
          cursor: help;
        }

        .confidence-tag[data-tooltip]::before {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 400;
          line-height: 1.5;
          width: max-content;
          max-width: 300px;
          text-align: center;
          background-color: rgb(24, 24, 27);
          color: rgb(250, 250, 250);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
          transform: translateX(-50%) translateY(4px);
          pointer-events: none;
          z-index: 9999;
        }

        /* Arrow */
        .confidence-tag[data-tooltip]::after {
          content: '';
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 10px;
          height: 10px;
          background-color: rgb(24, 24, 27);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
          z-index: 9998;
        }

        /* Show on hover with subtle animation */
        .confidence-tag[data-tooltip]:hover::before {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .confidence-tag[data-tooltip]:hover::after {
          opacity: 1;
          visibility: visible;
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
