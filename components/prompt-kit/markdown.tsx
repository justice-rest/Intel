"use client"

import { LinkMarkdown } from "@/app/components/chat/link-markdown"
import { cn } from "@/lib/utils"
import { memo, useId, useMemo } from "react"
import { Streamdown, type StreamdownProps } from "streamdown"
import type { BundledTheme } from "shiki"
import { ButtonCopy } from "../common/button-copy"
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "../prompt-kit/code-block"

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

  return (
    <div className={className} key={blockId}>
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
        {children}
      </Streamdown>
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
