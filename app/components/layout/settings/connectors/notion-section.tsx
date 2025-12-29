"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { cn } from "@/lib/utils"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Spinner,
  Trash,
  CheckCircle,
  WarningCircle,
  File,
  CaretDown,
  CaretUp,
  NotionLogo,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { NotionPagePicker } from "./notion-page-picker"

interface NotionIntegrationStatus {
  connected: boolean
  status: "active" | "disconnected" | "error" | "revoked"
  workspaceName?: string
  workspaceIcon?: string
  indexedPages: number
  processingPages: number
  errorMessage?: string
  configured: boolean
}

interface NotionDocument {
  id: string
  notion_page_id: string
  notion_page_title: string
  notion_object_type: "page" | "database"
  notion_icon?: string
  status: "pending" | "processing" | "ready" | "failed"
  word_count?: number
  block_count?: number
  created_at: string
}

export function NotionIntegrationSection() {
  const queryClient = useQueryClient()
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // Check URL params for success/error messages from OAuth callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const success = params.get("notion_success")
      const error = params.get("notion_error")

      if (success) {
        toast({
          title: "Notion Connected",
          description: success,
        })
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname)
      } else if (error) {
        toast({
          title: "Connection Failed",
          description: error,
        })
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [])

  // Fetch integration status
  const { data: status, isLoading } = useQuery({
    queryKey: ["notion-integration-status"],
    queryFn: async () => {
      const res = await fetchClient("/api/notion-integration")
      if (!res.ok) throw new Error("Failed to fetch status")
      return (await res.json()) as NotionIntegrationStatus
    },
    refetchOnWindowFocus: true,
  })

  // Fetch Notion documents with auto-refresh
  const { data: docsData } = useQuery({
    queryKey: ["notion-documents"],
    queryFn: async () => {
      const res = await fetchClient("/api/notion-integration/documents")
      if (!res.ok) return { documents: [], count: 0 }
      return res.json() as Promise<{ documents: NotionDocument[]; count: number }>
    },
    enabled: status?.connected === true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const documents = docsData?.documents || []

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const res = await fetchClient("/api/notion-integration/documents", {
        method: "DELETE",
        body: JSON.stringify({ pageId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Document Removed",
        description: "The page has been removed from your index.",
      })
      queryClient.invalidateQueries({ queryKey: ["notion-documents"] })
      queryClient.invalidateQueries({ queryKey: ["notion-integration-status"] })
      setDeletingDocId(null)
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
      })
      setDeletingDocId(null)
    },
  })

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/notion-integration/connect", {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to initiate connection")
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Redirect to Notion OAuth
      window.location.href = data.authUrl
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to connect to Notion",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/notion-integration", {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Notion Disconnected",
        description: "Your Notion account has been disconnected.",
      })
      queryClient.invalidateQueries({ queryKey: ["notion-integration-status"] })
      queryClient.invalidateQueries({ queryKey: ["notion-documents"] })
      setDisconnectDialogOpen(false)
    },
    onError: () => {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Notion account. Please try again.",
      })
      setDisconnectDialogOpen(false)
    },
  })

  const isConnected = status?.connected === true

  // Get emoji or icon for display
  const getIconDisplay = (icon?: string) => {
    if (!icon) return null
    // If it starts with emoji, render as text; otherwise it's a URL
    if (icon.startsWith("http")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="size-4 rounded" />
      )
    }
    return <span className="text-sm">{icon}</span>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Not configured - show setup required message
  if (!status?.configured) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <NotionLogo size={20} weight="fill" className="text-black dark:text-white" />
          <h3 className="text-base font-semibold text-black dark:text-white">
            Notion
          </h3>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
            BETA
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Import Notion pages and databases for AI-powered semantic search.
        </p>

        {/* Not Configured Card */}
        <div className="p-4 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded">
          <div className="text-center py-4">
            <WarningCircle size={32} weight="fill" className="mx-auto text-amber-500 mb-2" />
            <p className="text-sm font-medium text-black dark:text-white mb-1">
              Not Configured
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Notion integration requires configuration. Contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <NotionLogo size={20} weight="fill" className="text-black dark:text-white" />
        <h3 className="text-base font-semibold text-black dark:text-white">
          Notion
        </h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Import Notion pages and databases for AI-powered semantic search.
      </p>

      {/* Main Card */}
      <div className="p-4 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded">
        {isConnected ? (
          <div className="space-y-4">
            {/* Connected Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} weight="fill" className="text-green-500" />
                <span className="text-sm font-medium text-black dark:text-white">Connected</span>
                {status?.workspaceName && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({status.workspaceName})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDisconnectDialogOpen(true)}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <Trash size={12} />
                Disconnect
              </button>
            </div>

            <hr className="border-gray-200 dark:border-[#333]" />

            {/* Stats and Actions */}
            <div className="rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2 mb-3">
                <NotionLogo size={18} weight="fill" className="text-black dark:text-white" />
                <span className="text-sm font-medium text-black dark:text-white">Pages</span>
                <CheckCircle size={12} weight="fill" className="text-green-500" />
              </div>

              <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Indexed pages</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-black dark:text-white">{documents.length}</span>
                    {documents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDocuments(!showDocuments)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors"
                      >
                        {showDocuments ? (
                          <CaretUp size={12} />
                        ) : (
                          <CaretDown size={12} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {status?.processingPages > 0 && (
                  <div className="flex justify-between">
                    <span>Processing</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {status.processingPages}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <NotionPagePicker
                  onPagesImported={() => {
                    queryClient.invalidateQueries({ queryKey: ["notion-documents"] })
                    queryClient.invalidateQueries({ queryKey: ["notion-integration-status"] })
                  }}
                />
              </div>
            </div>

            {/* Documents List */}
            <AnimatePresence>
              {showDocuments && documents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Indexed Pages
                      </span>
                      <span className="text-xs text-gray-400">
                        {documents.length} page{documents.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#222] group"
                        >
                          {doc.notion_icon ? (
                            getIconDisplay(doc.notion_icon)
                          ) : (
                            <File size={14} className="text-gray-400 flex-shrink-0" />
                          )}
                          <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300" title={doc.notion_page_title}>
                            {doc.notion_page_title}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                            doc.status === "ready"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : doc.status === "processing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}>
                            {doc.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingDocId(doc.notion_page_id)
                              deleteDocumentMutation.mutate(doc.notion_page_id)
                            }}
                            disabled={deletingDocId === doc.notion_page_id}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {deletingDocId === doc.notion_page_id ? (
                              <Spinner size={12} className="animate-spin" />
                            ) : (
                              <Trash size={12} className="text-gray-400 hover:text-red-500" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Not Connected State */
          <div className="text-center py-4">
            {status?.status === "error" || status?.status === "revoked" ? (
              <>
                <WarningCircle size={32} weight="fill" className="mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-medium text-black dark:text-white mb-1">
                  {status.status === "revoked" ? "Access Revoked" : "Connection Error"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {status?.errorMessage || "Please reconnect your Notion account."}
                </p>
              </>
            ) : (
              <>
                <NotionLogo size={32} weight="fill" className="mx-auto text-gray-400 mb-3" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Connect your Notion workspace to import pages and databases.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 border border-black dark:border-white text-white dark:text-black transition-colors disabled:opacity-50"
            >
              {connectMutation.isPending && (
                <Spinner size={14} className="animate-spin" />
              )}
              <NotionLogo size={16} weight="fill" />
              Connect Notion
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
        Only pages shared with the integration can be imported.
      </p>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Disconnect Notion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to disconnect? This will:
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                <li>Remove access to your Notion workspace</li>
                <li>Delete all indexed pages from your account</li>
                <li>Remove the integration from Notion</li>
              </ul>
              <p className="mt-2 text-xs">
                Your original Notion pages will not be affected.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-300 dark:border-[#444]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {disconnectMutation.isPending && (
                <Spinner size={14} className="animate-spin mr-2" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
