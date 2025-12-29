"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
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
  Sparkle,
  File,
  CaretDown,
  CaretUp,
  Lock,
  ArrowUpRight,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "motion/react"
import type { GoogleIntegrationStatus, GoogleDriveDocument } from "@/lib/google/types"
import { GoogleDriveBrowser } from "./google-drive-browser"
import { NotionPagePicker } from "../connectors/notion-page-picker"
import { useCustomer } from "autumn-js/react"

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

/**
 * Check if a plan ID is Pro or Scale (eligible for Google Workspace)
 */
function isEligiblePlan(productId?: string): boolean {
  if (!productId) return false
  const lower = productId.toLowerCase()
  // Check if plan contains "pro" or "scale" as a word
  return /(?:^|[-_])(?:pro|scale)(?:[-_]|$)/i.test(lower) || lower === "pro" || lower === "scale"
}

export function GoogleIntegrationSection() {
  const queryClient = useQueryClient()
  const { customer } = useCustomer()
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [showDriveDocuments, setShowDriveDocuments] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // Notion state
  const [notionDisconnectDialogOpen, setNotionDisconnectDialogOpen] = useState(false)
  const [showNotionDocuments, setShowNotionDocuments] = useState(false)
  const [deletingNotionDocId, setDeletingNotionDocId] = useState<string | null>(null)

  // Check if user is on an eligible plan (Pro or Scale)
  const activeProduct = customer?.products?.find(
    (p: { status: string }) => p.status === "active" || p.status === "trialing"
  )
  const hasEligiblePlan = isEligiblePlan(activeProduct?.id)

  // Check URL params for success/error messages from OAuth callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const success = params.get("google_success")
      const error = params.get("google_error")

      if (success) {
        toast({
          title: "Google Connected",
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
    queryKey: ["google-integration-status"],
    queryFn: async () => {
      const res = await fetchClient("/api/google-integrations")
      if (!res.ok) throw new Error("Failed to fetch status")
      return (await res.json()) as GoogleIntegrationStatus
    },
    refetchOnWindowFocus: true,
  })

  // Fetch drive documents with auto-refresh
  const { data: driveDocsData } = useQuery({
    queryKey: ["drive-documents"],
    queryFn: async () => {
      const res = await fetchClient("/api/google-integrations/drive/documents")
      if (!res.ok) return { documents: [], count: 0 }
      return res.json() as Promise<{ documents: GoogleDriveDocument[]; count: number }>
    },
    enabled: status?.connected === true && status?.scopes?.some((s) => s.includes("drive")),
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  })

  const driveDocuments = driveDocsData?.documents || []

  // ============ NOTION INTEGRATION ============

  // Fetch Notion integration status
  const { data: notionStatus } = useQuery({
    queryKey: ["notion-integration-status"],
    queryFn: async () => {
      const res = await fetchClient("/api/notion-integration")
      if (!res.ok) throw new Error("Failed to fetch status")
      return (await res.json()) as NotionIntegrationStatus
    },
    refetchOnWindowFocus: true,
  })

  // Fetch Notion documents with auto-refresh
  const { data: notionDocsData } = useQuery({
    queryKey: ["notion-documents"],
    queryFn: async () => {
      const res = await fetchClient("/api/notion-integration/documents")
      if (!res.ok) return { documents: [], count: 0 }
      return res.json() as Promise<{ documents: NotionDocument[]; count: number }>
    },
    enabled: notionStatus?.connected === true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const notionDocuments = notionDocsData?.documents || []

  // Notion delete document mutation
  const deleteNotionDocumentMutation = useMutation({
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
      setDeletingNotionDocId(null)
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
      })
      setDeletingNotionDocId(null)
    },
  })

  // Notion connect mutation
  const connectNotionMutation = useMutation({
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

  // Notion disconnect mutation
  const disconnectNotionMutation = useMutation({
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
      setNotionDisconnectDialogOpen(false)
    },
    onError: () => {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Notion account. Please try again.",
      })
      setNotionDisconnectDialogOpen(false)
    },
  })

  const isNotionConnected = notionStatus?.connected === true
  const isNotionConfigured = notionStatus?.configured !== false

  // Get emoji or icon for Notion documents
  const getNotionIconDisplay = (icon?: string) => {
    if (!icon) return null
    if (icon.startsWith("http")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="size-4 rounded" />
      )
    }
    return <span className="text-sm">{icon}</span>
  }

  // ============ END NOTION INTEGRATION ============

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (driveFileId: string) => {
      const res = await fetchClient("/api/google-integrations/drive/documents", {
        method: "DELETE",
        body: JSON.stringify({ driveFileId }),
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
        description: "The document has been removed from your index.",
      })
      queryClient.invalidateQueries({ queryKey: ["drive-documents"] })
      queryClient.invalidateQueries({ queryKey: ["google-integration-status"] })
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
      const res = await fetchClient("/api/google-integrations/connect", {
        method: "POST",
        body: JSON.stringify({ scopes: "all" }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to initiate connection")
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to connect to Google",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/google-integrations", {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Google Disconnected",
        description: "Your Google account has been disconnected.",
      })
      queryClient.invalidateQueries({ queryKey: ["google-integration-status"] })
      setDisconnectDialogOpen(false)
    },
    onError: () => {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect Google account. Please try again.",
      })
      setDisconnectDialogOpen(false)
    },
  })

  // Analyze style mutation
  const analyzeStyleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/google-integrations/gmail/style", {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.message || "Failed to analyze style")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Style Analysis Complete",
        description: data.message,
      })
      queryClient.invalidateQueries({ queryKey: ["google-integration-status"] })
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description:
          error instanceof Error ? error.message : "Failed to analyze writing style",
      })
    },
  })

  const isConnected = status?.connected === true
  const hasGmail = status?.scopes?.some((s) => s.includes("gmail")) ?? false
  const hasDrive = status?.scopes?.some((s) => s.includes("drive")) ?? false

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Image
          src="/svgs/Google Color Icon.svg"
          alt="Google"
          width={20}
          height={20}
          className="size-5"
        />
        <h3 className="text-base font-semibold text-black dark:text-white">
          Google Workspace
        </h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
        {!hasEligiblePlan && (
          <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            PRO
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Connect Gmail and Drive for AI-powered email drafts and document search.
        {!hasEligiblePlan && (
          <span className="text-amber-600 dark:text-amber-400"> Requires Pro or Scale plan.</span>
        )}
      </p>

      {/* Main Card */}
      <div className="p-4 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded">
        {!hasEligiblePlan ? (
          /* Locked State - Requires Pro or Scale plan */
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-[#333] mb-3">
              <Lock size={24} className="text-gray-400" />
            </div>
            <h4 className="text-sm font-semibold text-black dark:text-white mb-1">
              Upgrade to Unlock
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-[280px] mx-auto">
              Google Workspace integration is available on Pro and Scale plans.
              Connect Gmail for AI-powered email drafts and Drive for document search.
            </p>
            <button
              type="button"
              onClick={() => {
                // Open subscription settings
                window.dispatchEvent(new CustomEvent("open-settings", { detail: { tab: "subscription" } }))
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded bg-black dark:bg-white hover:bg-transparent border border-black dark:border-white text-white dark:text-black hover:text-black dark:hover:text-white transition-all"
            >
              Upgrade Plan
              <ArrowUpRight size={14} />
            </button>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-3">
              Currently in beta. Rolling out to all Pro & Scale users soon.
            </p>
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            {/* Connected Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} weight="fill" className="text-green-500" />
                <span className="text-sm font-medium text-black dark:text-white">Connected</span>
                {status?.googleEmail && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({status.googleEmail})
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

            {/* Services - Combined Box with Divider */}
            <div className="rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {/* Gmail */}
                <div className={cn(
                  "p-4 flex flex-col",
                  !hasGmail && "opacity-60"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Image
                      src="/svgs/Gmail SVG Icon.svg"
                      alt="Gmail"
                      width={18}
                      height={18}
                      className="size-[18px]"
                    />
                    <span className="text-sm font-medium text-black dark:text-white">Gmail</span>
                    {hasGmail && <CheckCircle size={12} weight="fill" className="text-green-500" />}
                  </div>
                  {hasGmail && (
                    <div className="flex-1 flex flex-col">
                      <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 flex-1">
                        <div className="flex justify-between">
                          <span>Pending drafts</span>
                          <span className="font-medium text-black dark:text-white">{status?.pendingDrafts || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Style analyzed</span>
                          <span className={cn(
                            "font-medium",
                            status?.styleAnalyzedAt
                              ? "text-black dark:text-white"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            {status?.styleAnalyzedAt
                              ? `${formatDate(status.styleAnalyzedAt)} (${status.emailsAnalyzed})`
                              : "Not yet"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analyzeStyleMutation.mutate()}
                        disabled={analyzeStyleMutation.isPending}
                        className="w-full mt-3"
                      >
                        {analyzeStyleMutation.isPending ? (
                          <Spinner size={16} className="mr-2 animate-spin" />
                        ) : (
                          <Sparkle size={16} weight="fill" className="mr-2" />
                        )}
                        {status?.styleAnalyzedAt ? "Re-analyze Style" : "Analyze Style"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Mobile Divider */}
                <div className="sm:hidden h-px bg-white/10 dark:bg-white/5" />

                {/* Drive */}
                <div className={cn(
                  "p-4 flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 dark:border-white/5",
                  !hasDrive && "opacity-60"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Image
                      src="/svgs/Drive Color Icon.svg"
                      alt="Drive"
                      width={18}
                      height={18}
                      className="size-[18px]"
                    />
                    <span className="text-sm font-medium text-black dark:text-white">Drive</span>
                    {hasDrive && <CheckCircle size={12} weight="fill" className="text-green-500" />}
                  </div>
                  {hasDrive && (
                    <div className="flex-1 flex flex-col">
                      <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 flex-1">
                        <div className="flex items-center justify-between">
                          <span>Indexed documents</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-black dark:text-white">{driveDocuments.length}</span>
                            {driveDocuments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowDriveDocuments(!showDriveDocuments)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors"
                              >
                                {showDriveDocuments ? (
                                  <CaretUp size={12} />
                                ) : (
                                  <CaretDown size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <GoogleDriveBrowser
                          onFilesImported={() => {
                            queryClient.invalidateQueries({ queryKey: ["drive-documents"] })
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Horizontal Divider between Google services and Notion */}
              <div className="h-px bg-gray-200 dark:bg-[#333]" />

              {/* Notion Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/svgs/Notion Icon.svg"
                      alt="Notion"
                      width={18}
                      height={18}
                      className="size-[18px] dark:invert"
                    />
                    <span className="text-sm font-medium text-black dark:text-white">Notion</span>
                    {isNotionConnected && <CheckCircle size={12} weight="fill" className="text-green-500" />}
                  </div>
                  {isNotionConnected && (
                    <button
                      type="button"
                      onClick={() => setNotionDisconnectDialogOpen(true)}
                      disabled={disconnectNotionMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash size={12} />
                      Disconnect
                    </button>
                  )}
                </div>

                {!isNotionConfigured ? (
                  <div className="text-center py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Notion integration requires configuration. Contact your administrator.
                    </p>
                  </div>
                ) : isNotionConnected ? (
                  <div className="space-y-3">
                    {notionStatus?.workspaceName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Workspace: {notionStatus.workspaceName}
                      </p>
                    )}
                    <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center justify-between">
                        <span>Indexed pages</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-black dark:text-white">{notionDocuments.length}</span>
                          {notionDocuments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowNotionDocuments(!showNotionDocuments)}
                              className="p-0.5 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors"
                            >
                              {showNotionDocuments ? (
                                <CaretUp size={12} />
                              ) : (
                                <CaretDown size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {notionStatus?.processingPages > 0 && (
                        <div className="flex justify-between">
                          <span>Processing</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {notionStatus.processingPages}
                          </span>
                        </div>
                      )}
                    </div>
                    <NotionPagePicker
                      onPagesImported={() => {
                        queryClient.invalidateQueries({ queryKey: ["notion-documents"] })
                        queryClient.invalidateQueries({ queryKey: ["notion-integration-status"] })
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Connect Notion to import pages and databases.
                    </p>
                    <button
                      type="button"
                      onClick={() => connectNotionMutation.mutate()}
                      disabled={connectNotionMutation.isPending}
                      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 border border-black dark:border-white text-white dark:text-black transition-colors disabled:opacity-50"
                    >
                      {connectNotionMutation.isPending && (
                        <Spinner size={12} className="animate-spin" />
                      )}
                      <Image
                        src="/svgs/Notion Icon.svg"
                        alt="Notion"
                        width={14}
                        height={14}
                        className="size-3.5 dark:invert"
                      />
                      Connect Notion
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Drive Documents List */}
            <AnimatePresence>
              {showDriveDocuments && driveDocuments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border border-gray-200 dark:border-[#333] rounded bg-white dark:bg-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Indexed Documents
                      </span>
                      <span className="text-xs text-gray-400">
                        {driveDocuments.length} file{driveDocuments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {driveDocuments.map((doc) => (
                        <div
                          key={doc.drive_file_id}
                          className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#222] group"
                        >
                          <File size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300" title={doc.drive_file_name}>
                            {doc.drive_file_name}
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
                              setDeletingDocId(doc.drive_file_id)
                              deleteDocumentMutation.mutate(doc.drive_file_id)
                            }}
                            disabled={deletingDocId === doc.drive_file_id}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {deletingDocId === doc.drive_file_id ? (
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

            {/* Notion Documents List */}
            <AnimatePresence>
              {showNotionDocuments && notionDocuments.length > 0 && (
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
                        {notionDocuments.length} page{notionDocuments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {notionDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#222] group"
                        >
                          {doc.notion_icon ? (
                            getNotionIconDisplay(doc.notion_icon)
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
                              setDeletingNotionDocId(doc.notion_page_id)
                              deleteNotionDocumentMutation.mutate(doc.notion_page_id)
                            }}
                            disabled={deletingNotionDocId === doc.notion_page_id}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {deletingNotionDocId === doc.notion_page_id ? (
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
                  {status.errorMessage || "Please reconnect your Google account."}
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center gap-3 mb-3">
                  <Image
                    src="/svgs/Gmail SVG Icon.svg"
                    alt="Gmail"
                    width={24}
                    height={24}
                    className="size-6 opacity-50"
                  />
                  <Image
                    src="/svgs/Drive Color Icon.svg"
                    alt="Drive"
                    width={24}
                    height={24}
                    className="size-6 opacity-50"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Connect your Google account to enable Gmail and Drive features.
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
              <Image
                src="/svgs/Google Color Icon.svg"
                alt="Google"
                width={16}
                height={16}
                className="size-4"
              />
              Connect Google Account
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 mb-4">
        AI can only create drafts - you must send emails from Gmail.
      </p>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Disconnect Google Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to disconnect? This will:
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                <li>Remove access to Gmail and Google Drive</li>
                <li>Delete your stored writing style profile</li>
                <li>Remove all indexed Drive documents</li>
              </ul>
              <p className="mt-2 text-xs">
                Existing email drafts in Gmail will not be affected.
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

      {/* Notion Disconnect Confirmation Dialog */}
      <AlertDialog open={notionDisconnectDialogOpen} onOpenChange={setNotionDisconnectDialogOpen}>
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
              onClick={() => disconnectNotionMutation.mutate()}
              disabled={disconnectNotionMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {disconnectNotionMutation.isPending && (
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
