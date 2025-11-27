"use client"

import { useEffect, useId, useState } from "react"
import { cn } from "@/lib/utils"
import { ButtonCopy } from "../common/button-copy"
import { DownloadIcon, Maximize2Icon, XIcon } from "lucide-react"

interface MermaidDiagramProps {
  chart: string
  className?: string
}

export default function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const id = useId().replace(/:/g, "-")

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
          fontFamily: "monospace",
        })

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${id}`, chart)
        if (!cancelled) {
          setSvg(renderedSvg)
          setError("")
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      }
    }

    renderDiagram()
    return () => { cancelled = true }
  }, [chart, id])

  const handleDownloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "diagram.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Diagram Error: {error}</p>
        <pre className="mt-2 text-xs text-muted-foreground overflow-auto">{chart}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-xl border p-8">
        <span className="text-sm text-muted-foreground">Rendering diagram...</span>
      </div>
    )
  }

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
