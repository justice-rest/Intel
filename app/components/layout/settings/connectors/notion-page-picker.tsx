"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Upload,
  CheckCircle,
  AlertCircle,
  File,
  Database,
  X,
  Search,
  FolderOpen,
  Check,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface NotionPageItem {
  id: string
  title: string
  type: "page" | "database"
  icon?: string
  url: string
  lastEditedTime: string
  indexed: boolean
  indexStatus: string | null
}

interface SelectedPage extends NotionPageItem {
  status: "pending" | "processing" | "ready" | "failed"
  error?: string
}

interface NotionPagePickerProps {
  onPagesImported?: (count: number) => void
}

// Get emoji or icon for display
function getIconDisplay(icon?: string, type?: "page" | "database") {
  if (icon) {
    // If it starts with http, it's a URL
    if (icon.startsWith("http")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="size-5 rounded" />
      )
    }
    // Otherwise it's an emoji
    return <span className="text-base leading-none">{icon}</span>
  }
  // Default icons
  if (type === "database") {
    return <Database className="size-5 text-blue-600" />
  }
  return <File className="size-5 text-muted-foreground" />
}

// Format date
function formatDate(dateString?: string): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function NotionPagePicker({ onPagesImported }: NotionPagePickerProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set())
  const [selectedPages, setSelectedPages] = useState<SelectedPage[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [showImportProgress, setShowImportProgress] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch pages from Notion
  const {
    data: pagesData,
    isLoading: isLoadingPages,
    error: pagesError,
    refetch: refetchPages,
  } = useQuery({
    queryKey: ["notion-pages", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" })
      if (debouncedSearch) {
        params.set("query", debouncedSearch)
      }
      const res = await fetchClient(`/api/notion-integration/pages?${params}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch pages")
      }
      return res.json()
    },
    enabled: isOpen,
    staleTime: 30000,
  })

  const pages: NotionPageItem[] = pagesData?.pages || []

  // Filter out already indexed pages
  const availablePages = pages.filter((p) => !p.indexed || p.indexStatus !== "ready")

  // Toggle page selection
  const togglePageSelection = useCallback((page: NotionPageItem) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev)
      if (next.has(page.id)) {
        next.delete(page.id)
      } else {
        next.add(page.id)
      }
      return next
    })
  }, [])

  // Process page mutation
  const processPageMutation = useMutation({
    mutationFn: async (page: SelectedPage) => {
      const res = await fetchClient("/api/notion-integration/process", {
        method: "POST",
        body: JSON.stringify({
          pageId: page.id,
          type: page.type,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to process page")
      }
      return res.json()
    },
  })

  // Start import process
  const handleStartImport = useCallback(() => {
    // Get selected pages (excluding already indexed)
    const pagesToImport = availablePages.filter((p) => selectedPageIds.has(p.id))
    if (pagesToImport.length === 0) return

    // Initialize with pending status
    setSelectedPages(
      pagesToImport.map((p) => ({ ...p, status: "pending" as const }))
    )
    setShowImportProgress(true)
  }, [availablePages, selectedPageIds])

  // Process all pages
  const handleImport = async () => {
    if (selectedPages.length === 0) return

    setIsImporting(true)
    let successCount = 0

    for (const page of selectedPages) {
      // Update status to processing
      setSelectedPages((prev) =>
        prev.map((p) =>
          p.id === page.id ? { ...p, status: "processing" as const } : p
        )
      )

      try {
        await processPageMutation.mutateAsync(page)
        setSelectedPages((prev) =>
          prev.map((p) =>
            p.id === page.id ? { ...p, status: "ready" as const } : p
          )
        )
        successCount++
      } catch (error) {
        setSelectedPages((prev) =>
          prev.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  status: "failed" as const,
                  error: error instanceof Error ? error.message : "Import failed",
                }
              : p
          )
        )
      }
    }

    setIsImporting(false)

    if (successCount > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} of ${selectedPages.length} pages`,
      })
      queryClient.invalidateQueries({ queryKey: ["notion-integration-status"] })
      queryClient.invalidateQueries({ queryKey: ["notion-documents"] })
      onPagesImported?.(successCount)
    }
  }

  const removePage = (pageId: string) => {
    setSelectedPages((prev) => prev.filter((p) => p.id !== pageId))
  }

  const clearCompleted = () => {
    setSelectedPages((prev) => prev.filter((p) => p.status !== "ready"))
  }

  const handleClose = () => {
    if (!isImporting) {
      setIsOpen(false)
      setShowImportProgress(false)
      setSelectedPageIds(new Set())
      setSelectedPages([])
      setSearchQuery("")
    }
  }

  const handleBack = () => {
    if (!isImporting) {
      setShowImportProgress(false)
      setSelectedPages([])
    }
  }

  const pendingPages = selectedPages.filter((p) => p.status === "pending")
  const completedPages = selectedPages.filter((p) => p.status === "ready")
  const failedPages = selectedPages.filter((p) => p.status === "failed")

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full"
      >
        <FolderOpen className="mr-2 size-4" />
        Browse Notion Pages
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showImportProgress ? (
                <>
                  <Upload className="size-5" />
                  Import Pages
                </>
              ) : (
                <>
                  <FolderOpen className="size-5" />
                  Notion
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {showImportProgress
                ? "Selected pages will be processed and indexed for AI search."
                : "Select pages to import into Rōmy for AI-powered search."}
            </DialogDescription>
          </DialogHeader>

          {!showImportProgress ? (
            // Page browser view
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#222] text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Page list */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#1a1a1a]">
                {isLoadingPages ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pagesError ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <AlertCircle className="size-8 mb-2" />
                    <p className="text-sm">Failed to load pages</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchPages()}
                      className="mt-2"
                    >
                      Try again
                    </Button>
                  </div>
                ) : pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <File className="size-8 mb-2" />
                    <p className="text-sm">
                      {debouncedSearch ? "No pages match your search" : "No accessible pages found"}
                    </p>
                    <p className="text-xs mt-1 text-center px-4">
                      Make sure to share pages with the Rōmy integration in Notion
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-[#333]">
                    {pages.map((page) => {
                      const isSelected = selectedPageIds.has(page.id)
                      const isIndexed = page.indexed && page.indexStatus === "ready"
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => !isIndexed && togglePageSelection(page)}
                          disabled={isIndexed}
                          className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-[#333] transition-colors ${
                            isSelected ? "bg-gray-100 dark:bg-[#333]" : ""
                          } ${isIndexed ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className={`flex-shrink-0 size-5 rounded border flex items-center justify-center transition-colors ${
                            isIndexed
                              ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
                              : isSelected
                                ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black"
                                : "border-gray-300 dark:border-[#555]"
                          }`}>
                            {isIndexed ? (
                              <Check className="size-3 text-green-600 dark:text-green-400" />
                            ) : isSelected ? (
                              <Check className="size-3" />
                            ) : null}
                          </div>
                          {getIconDisplay(page.icon, page.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{page.title || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">
                              {page.type === "database" ? "Database" : "Page"}
                              {" • "}
                              {formatDate(page.lastEditedTime)}
                            </p>
                          </div>
                          {isIndexed && (
                            <Badge variant="secondary" className="text-[10px]">
                              Indexed
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Selection summary and actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedPageIds.size} page{selectedPageIds.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartImport}
                    disabled={selectedPageIds.size === 0}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Import progress view
            <div className="space-y-3">
              {/* Page List */}
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                <AnimatePresence mode="popLayout">
                  {selectedPages.map((page) => (
                    <motion.div
                      key={page.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      {getIconDisplay(page.icon, page.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.title || "Untitled"}</p>
                        {page.error && (
                          <p className="text-xs text-destructive">{page.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {page.status === "pending" && (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                        {page.status === "processing" && (
                          <Loader2 className="size-4 animate-spin text-blue-500" />
                        )}
                        {page.status === "ready" && (
                          <CheckCircle className="size-4 text-green-500" />
                        )}
                        {page.status === "failed" && (
                          <AlertCircle className="size-4 text-destructive" />
                        )}
                        {page.status === "pending" && !isImporting && (
                          <button
                            onClick={() => removePage(page.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <X className="size-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Summary */}
              {selectedPages.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                  <span>
                    {pendingPages.length > 0 && `${pendingPages.length} pending`}
                    {completedPages.length > 0 &&
                      `${pendingPages.length > 0 ? ", " : ""}${completedPages.length} completed`}
                    {failedPages.length > 0 &&
                      `${pendingPages.length > 0 || completedPages.length > 0 ? ", " : ""}${failedPages.length} failed`}
                  </span>
                  {completedPages.length > 0 && !isImporting && (
                    <button
                      onClick={clearCompleted}
                      className="text-xs hover:underline"
                    >
                      Clear completed
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!isImporting && pendingPages.length > 0 && (
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
                {pendingPages.length > 0 && (
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>Import {pendingPages.length} Page{pendingPages.length !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                )}
                {!isImporting && (
                  <Button variant="outline" onClick={handleClose}>
                    {pendingPages.length > 0 ? "Cancel" : "Done"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
