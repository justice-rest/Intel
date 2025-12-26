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
  Upload,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "motion/react"
import type { GoogleIntegrationStatus, GoogleDriveDocument } from "@/lib/google/types"
import { GoogleDrivePicker } from "./google-drive-picker"

export function GoogleIntegrationSection() {
  const queryClient = useQueryClient()
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [showDriveDocuments, setShowDriveDocuments] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

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

  // Fetch drive documents
  const { data: driveDocsData } = useQuery({
    queryKey: ["drive-documents"],
    queryFn: async () => {
      const res = await fetchClient("/api/google-integrations/drive/documents")
      if (!res.ok) return { documents: [], count: 0 }
      return res.json() as Promise<{ documents: GoogleDriveDocument[]; count: number }>
    },
    enabled: status?.connected === true && status?.scopes?.some((s) => s.includes("drive")),
    refetchOnWindowFocus: false,
  })

  const driveDocuments = driveDocsData?.documents || []

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
        <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          NEW
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Connect Gmail and Drive for AI-powered email drafts and document search.
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

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gmail */}
              <div className={cn(
                "p-3 rounded border flex flex-col",
                hasGmail
                  ? "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#333]"
                  : "bg-gray-100 dark:bg-[#2a2a2a] border-gray-200 dark:border-[#333] opacity-60"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src="/svgs/Gmail SVG Icon.svg"
                    alt="Gmail"
                    width={20}
                    height={20}
                    className="size-5"
                  />
                  <span className="text-sm font-medium text-black dark:text-white">Gmail</span>
                  {hasGmail && <CheckCircle size={12} weight="fill" className="text-green-500" />}
                </div>
                {hasGmail && (
                  <div className="flex-1 flex flex-col">
                    <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 flex-1">
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

              {/* Drive */}
              <div className={cn(
                "p-3 rounded border flex flex-col",
                hasDrive
                  ? "bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#333]"
                  : "bg-gray-100 dark:bg-[#2a2a2a] border-gray-200 dark:border-[#333] opacity-60"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src="/svgs/Drive Color Icon.svg"
                    alt="Drive"
                    width={20}
                    height={20}
                    className="size-5"
                  />
                  <span className="text-sm font-medium text-black dark:text-white">Drive</span>
                  {hasDrive && <CheckCircle size={12} weight="fill" className="text-green-500" />}
                </div>
                {hasDrive && (
                  <div className="flex-1 flex flex-col">
                    <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 flex-1">
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
                      <GoogleDrivePicker
                        onFilesImported={() => {
                          queryClient.invalidateQueries({ queryKey: ["drive-documents"] })
                        }}
                      />
                    </div>
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
                          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                            {doc.drive_file_name}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
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
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-opacity"
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded bg-[rgb(255,187,16)] hover:bg-transparent border border-[rgb(255,187,16)] text-black dark:hover:text-white transition-all disabled:opacity-50"
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
    </div>
  )
}
