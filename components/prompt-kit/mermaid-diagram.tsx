"use client"

import { useContext, useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ButtonCopy } from "../common/button-copy"
import { DownloadIcon, Maximize2Icon, XIcon } from "lucide-react"
import { StreamdownContext } from "streamdown"

interface MermaidDiagramProps {
  chart: string
  className?: string
}

export default function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isRendering, setIsRendering] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const id = useId().replace(/:/g, "-")
  const renderCountRef = useRef(0)

  // Get streaming state from Streamdown context
  const streamdownContext = useContext(StreamdownContext)
  const isAnimating = streamdownContext?.isAnimating ?? false

  useEffect(() => {
    // Don't attempt to render while streaming
    if (isAnimating) {
      setIsRendering(false)
      return
    }

    let cancelled = false
    const currentRender = ++renderCountRef.current

    // Debounce rendering to avoid rapid re-renders
    const timeoutId = setTimeout(async () => {
      if (cancelled || currentRender !== renderCountRef.current) return

      setIsRendering(true)
      setError("") // Clear any previous errors

      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          fontFamily: "monospace",
          suppressErrorRendering: true,
        })

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}-${currentRender}`, chart)
        if (!cancelled && currentRender === renderCountRef.current) {
          setSvg(renderedSvg)
          setError("")
        }
      } catch (err) {
        if (!cancelled && currentRender === renderCountRef.current) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      } finally {
        if (!cancelled && currentRender === renderCountRef.current) {
          setIsRendering(false)
        }
      }
    }, 500) // 500ms debounce

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [chart, id, isAnimating])

  const handleDownloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "diagram.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  // While streaming or debouncing, show code preview
  if (isAnimating || isRendering || (!svg && !error)) {
    return (
      <div className={cn("my-4 rounded-xl border overflow-hidden", className)} data-streamdown="mermaid-block">
        <div className="flex h-9 items-center justify-between px-4 border-b bg-muted/50">
          <span className="text-muted-foreground font-mono text-xs">mermaid</span>
          <span className="text-muted-foreground text-xs">
            {isAnimating ? "Streaming..." : "Rendering..."}
          </span>
        </div>
        <pre className="p-4 text-sm font-mono text-muted-foreground overflow-auto max-h-64">
          {chart}
        </pre>
      </div>
    )
  }

  // Show error only after streaming complete and render failed
  if (error) {
    return (
      <div className="my-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Diagram Error: {error}</p>
        <pre className="mt-2 text-xs text-muted-foreground overflow-auto">{chart}</pre>
      </div>
    )
  }

  // Show rendered diagram
  return (
    <>
      <div className={cn("group relative my-4 rounded-xl border p-4", className)} data-streamdown="mermaid-block">
        <div className="flex items-center justify-end gap-1 mb-2">
          <button
            onClick={handleDownloadSvg}
            className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground"
            title="Download SVG"
            type="button"
          >
            <DownloadIcon size={14} />
          </button>
          <ButtonCopy code={chart} />
          <button
            onClick={() => setIsFullscreen(true)}
            className="cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground"
            title="Fullscreen"
            type="button"
          >
            <Maximize2Icon size={14} />
          </button>
        </div>
        <div
          className="overflow-auto [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 z-10 rounded-md p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            onClick={() => setIsFullscreen(false)}
            type="button"
          >
            <XIcon size={20} />
          </button>
          <div
            className="flex h-full w-full items-center justify-center p-4 overflow-auto [&>svg]:max-w-full [&>svg]:max-h-full"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      )}
    </>
  )
}
