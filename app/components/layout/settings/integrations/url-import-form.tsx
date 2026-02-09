"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import {
  Spinner,
  CheckCircle,
  XCircle,
  Globe,
  ArrowRight,
  X,
} from "@phosphor-icons/react"
import type { CrawlProgress } from "@/lib/web-crawl/types"

interface ImportedPage {
  url: string
  title: string
  status: "processing" | "ready" | "error"
  error?: string
}

export function UrlImportForm() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [importedPages, setImportedPages] = useState<ImportedPage[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleImport = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    // Basic client-side validation
    try {
      const parsed = new URL(trimmed)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("Only HTTP and HTTPS URLs are supported.")
        return
      }
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com)")
      return
    }

    setIsImporting(true)
    setError(null)
    setImportedPages([])
    setProgress(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/rag/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      })

      // Handle non-SSE error responses
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Import failed" }))
        throw new Error(data.error || `Import failed (${response.status})`)
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === "[DONE]") continue

          try {
            const event = JSON.parse(jsonStr) as CrawlProgress
            setProgress(event)

            switch (event.type) {
              case "page_fetched":
                if (event.url && event.title) {
                  setImportedPages((prev) => [
                    ...prev,
                    { url: event.url!, title: event.title!, status: "processing" },
                  ])
                }
                break

              case "page_ready":
                if (event.url) {
                  setImportedPages((prev) =>
                    prev.map((p) =>
                      p.url === event.url ? { ...p, status: "ready" } : p
                    )
                  )
                }
                break

              case "page_error":
                if (event.url) {
                  // Update existing page or add new error entry
                  setImportedPages((prev) => {
                    const existing = prev.find((p) => p.url === event.url)
                    if (existing) {
                      return prev.map((p) =>
                        p.url === event.url
                          ? { ...p, status: "error", error: event.error }
                          : p
                      )
                    }
                    return [
                      ...prev,
                      { url: event.url!, title: event.url!, status: "error", error: event.error },
                    ]
                  })
                }
                break

              case "crawl_complete": {
                const indexed = event.pagesProcessed
                if (indexed > 0) {
                  toast({
                    title: "Import Complete",
                    description: `${indexed} page${indexed !== 1 ? "s" : ""} imported successfully.`,
                  })
                  queryClient.invalidateQueries({ queryKey: ["rag-documents"] })
                } else {
                  setError("No pages could be imported from this URL.")
                }
                break
              }

              case "crawl_error":
                setError(event.error || "Crawl failed")
                break
            }
          } catch {
            // Malformed SSE data — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast({
          title: "Import Cancelled",
          description: "URL import was cancelled.",
        })
        // Refresh to show any partially imported pages
        queryClient.invalidateQueries({ queryKey: ["rag-documents"] })
      } else {
        const msg = err instanceof Error ? err.message : "Failed to import URL"
        setError(msg)
        toast({ title: "Import Failed", description: msg })
      }
    } finally {
      setIsImporting(false)
      abortRef.current = null
    }
  }, [url, queryClient])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isImporting) {
        handleImport()
      }
    },
    [handleImport, isImporting]
  )

  const hostname = useMemo(() => {
    try {
      return new URL(url.trim()).hostname
    } catch {
      return null
    }
  }, [url])

  const progressPercent = progress
    ? Math.round(
        (progress.pagesProcessed / Math.max(progress.pagesTotal, 1)) * 100
      )
    : 0

  return (
    <div className="space-y-3">
      {/* URL Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Globe
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            disabled={isImporting}
            className={cn(
              "w-full pl-8 pr-3 py-2 text-xs rounded border transition-colors",
              "bg-white dark:bg-[#1a1a1a] text-black dark:text-white",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              error
                ? "border-red-300 dark:border-red-800"
                : "border-gray-300 dark:border-[#444] focus:border-gray-400 dark:focus:border-[#555]",
              "focus:outline-none",
              isImporting && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>
        {isImporting ? (
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded border border-gray-300 dark:border-[#444] hover:bg-gray-100 dark:hover:bg-[#333] transition-colors text-gray-700 dark:text-gray-300"
          >
            <X size={12} />
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={handleImport}
            disabled={!url.trim()}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-xs font-medium rounded transition-colors",
              url.trim()
                ? "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100"
                : "bg-gray-200 dark:bg-[#333] text-gray-400 dark:text-gray-500 cursor-not-allowed"
            )}
          >
            Import
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Progress */}
      {isImporting && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Importing from {hostname}...
            </span>
            <span>
              {progress.pagesProcessed}/{progress.pagesTotal} pages
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Imported Pages List */}
      {importedPages.length > 0 && (
        <div className="space-y-1 max-h-[120px] overflow-y-auto">
          {importedPages.map((page) => (
            <div
              key={page.url}
              className="flex items-center gap-2 text-xs py-1 px-1"
            >
              {page.status === "ready" ? (
                <CheckCircle size={12} weight="fill" className="text-green-500 flex-shrink-0" />
              ) : page.status === "processing" ? (
                <Spinner size={12} className="animate-spin text-gray-400 flex-shrink-0" />
              ) : (
                <XCircle size={12} weight="fill" className="text-red-400 flex-shrink-0" />
              )}
              <span
                className={cn(
                  "truncate",
                  page.status === "error"
                    ? "text-gray-400 dark:text-gray-500"
                    : "text-gray-600 dark:text-gray-400"
                )}
                title={page.error ? `${page.title} — ${page.error}` : page.title}
              >
                {page.title}
              </span>
              {page.error && (
                <span className="text-[10px] text-red-400 flex-shrink-0">
                  ({page.error})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      {!isImporting && importedPages.length === 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          Crawls up to 25 pages (depth 3). Each page becomes a searchable document.
        </p>
      )}
    </div>
  )
}
