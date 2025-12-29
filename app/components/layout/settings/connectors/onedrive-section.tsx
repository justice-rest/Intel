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
  MicrosoftOutlookLogo,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import { OneDriveFileBrowser } from "./onedrive-file-browser"

interface OneDriveIntegrationStatus {
  connected: boolean
  status: "active" | "disconnected" | "expired" | "error" | "revoked"
  microsoftEmail?: string
  displayName?: string
  indexedFiles: number
  processingFiles: number
  errorMessage?: string
  configured: boolean
}

interface OneDriveDocument {
  id: string
  onedrive_item_id: string
  onedrive_file_name: string
  onedrive_file_path?: string
  onedrive_mime_type: string
  status: "pending" | "processing" | "ready" | "failed"
  file_size?: number
  word_count?: number
  created_at: string
}

// OneDrive icon SVG
function OneDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.763 15.188L9.88 9.61a5.476 5.476 0 00-4.01-1.752 5.476 5.476 0 00-1.372.174 6.851 6.851 0 014.49-1.659c2.845 0 5.323 1.72 6.396 4.176l-.621 4.639z" fill="#0364B8"/>
      <path d="M14.763 15.188l-.621-4.639-.006-.032a6.86 6.86 0 012.498-.467c1.226 0 2.395.32 3.409.885l-2.36 5.83-2.92-1.577z" fill="#0078D4"/>
      <path d="M20.043 11.02a4.803 4.803 0 00-.814-.069c-.663 0-1.295.133-1.872.374a4.876 4.876 0 00-2.723 4.441v.422l5.409-5.168z" fill="#1490DF"/>
      <path d="M5.87 8.032a5.476 5.476 0 00-1.372-.174 5.498 5.498 0 00-3.124.973A5.476 5.476 0 000 13.377v.396c0 .603.097 1.183.275 1.726l7.148-3.49 2.457-.399-4.01-3.578z" fill="#28A8EA"/>
      <path d="M.275 15.5a5.476 5.476 0 003.223 4.086l.004.002a5.471 5.471 0 001.996.385h11.305a4.873 4.873 0 001.831-9.379l-3.87 1.594L7.423 10.61.275 15.5z" fill="#0078D4"/>
      <path d="M14.763 15.188l2.92 1.577 2.36-5.83a4.895 4.895 0 012.591 4.318 4.857 4.857 0 01-.996 2.956l-4.835 1.764-2.04-4.785z" fill="#14447D"/>
      <path d="M16.803 19.973H5.498a5.471 5.471 0 01-1.996-.385l-.004-.002 3.86-5.877 7.405 2.479 2.04 3.785z" fill="#0364B8"/>
    </svg>
  )
}

export function OneDriveIntegrationSection() {
  const queryClient = useQueryClient()
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // Check URL params for success/error messages from OAuth callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const success = params.get("onedrive_success")
      const error = params.get("onedrive_error")

      if (success) {
        toast({
          title: "OneDrive Connected",
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
    queryKey: ["onedrive-integration-status"],
    queryFn: async () => {
      const res = await fetchClient("/api/onedrive-integration")
      if (!res.ok) throw new Error("Failed to fetch status")
      return (await res.json()) as OneDriveIntegrationStatus
    },
    refetchOnWindowFocus: true,
  })

  // Fetch OneDrive documents with auto-refresh
  const { data: docsData } = useQuery({
    queryKey: ["onedrive-documents"],
    queryFn: async () => {
      const res = await fetchClient("/api/onedrive-integration/documents")
      if (!res.ok) return { documents: [], count: 0 }
      return res.json() as Promise<{ documents: OneDriveDocument[]; count: number }>
    },
    enabled: status?.connected === true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  const documents = docsData?.documents || []

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetchClient("/api/onedrive-integration/documents", {
        method: "DELETE",
        body: JSON.stringify({ fileId }),
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
        description: "The file has been removed from your index.",
      })
      queryClient.invalidateQueries({ queryKey: ["onedrive-documents"] })
      queryClient.invalidateQueries({ queryKey: ["onedrive-integration-status"] })
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
      const res = await fetchClient("/api/onedrive-integration/connect", {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to initiate connection")
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Redirect to Microsoft OAuth
      window.location.href = data.authUrl
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description:
          error instanceof Error ? error.message : "Failed to connect to OneDrive",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/onedrive-integration", {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "OneDrive Disconnected",
        description: "Your Microsoft account has been disconnected.",
      })
      queryClient.invalidateQueries({ queryKey: ["onedrive-integration-status"] })
      queryClient.invalidateQueries({ queryKey: ["onedrive-documents"] })
      setDisconnectDialogOpen(false)
    },
    onError: () => {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect OneDrive account. Please try again.",
      })
      setDisconnectDialogOpen(false)
    },
  })

  const isConnected = status?.connected === true

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get file icon based on mime type
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getFileIcon = (mimeType: string) => {
    // TODO: Add specific icons based on mime type (Word, Excel, PDF, etc.)
    return <File size={14} className="text-gray-400 flex-shrink-0" />
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
          <OneDriveIcon className="size-5" />
          <h3 className="text-base font-semibold text-black dark:text-white">
            OneDrive
          </h3>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
            BETA
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Import OneDrive documents for AI-powered semantic search.
        </p>

        {/* Not Configured Card */}
        <div className="p-4 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded">
          <div className="text-center py-4">
            <WarningCircle size={32} weight="fill" className="mx-auto text-amber-500 mb-2" />
            <p className="text-sm font-medium text-black dark:text-white mb-1">
              Not Configured
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              OneDrive integration requires configuration. Contact your administrator.
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
        <OneDriveIcon className="size-5" />
        <h3 className="text-base font-semibold text-black dark:text-white">
          OneDrive
        </h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Import OneDrive documents for AI-powered semantic search.
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
                {(status?.displayName || status?.microsoftEmail) && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({status.displayName || status.microsoftEmail})
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
                <OneDriveIcon className="size-[18px]" />
                <span className="text-sm font-medium text-black dark:text-white">Files</span>
                <CheckCircle size={12} weight="fill" className="text-green-500" />
              </div>

              <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Indexed files</span>
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
                {status?.processingFiles > 0 && (
                  <div className="flex justify-between">
                    <span>Processing</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {status.processingFiles}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <OneDriveFileBrowser
                  onFilesImported={() => {
                    queryClient.invalidateQueries({ queryKey: ["onedrive-documents"] })
                    queryClient.invalidateQueries({ queryKey: ["onedrive-integration-status"] })
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
                        Indexed Files
                      </span>
                      <span className="text-xs text-gray-400">
                        {documents.length} file{documents.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 text-xs p-2 rounded hover:bg-gray-50 dark:hover:bg-[#222] group"
                        >
                          {getFileIcon(doc.onedrive_mime_type)}
                          <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300" title={doc.onedrive_file_name}>
                            {doc.onedrive_file_name}
                          </span>
                          {doc.file_size && (
                            <span className="text-gray-400 text-[10px]">
                              {formatFileSize(doc.file_size)}
                            </span>
                          )}
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
                              setDeletingDocId(doc.onedrive_item_id)
                              deleteDocumentMutation.mutate(doc.onedrive_item_id)
                            }}
                            disabled={deletingDocId === doc.onedrive_item_id}
                            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-[#333] rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {deletingDocId === doc.onedrive_item_id ? (
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
            {status?.status === "error" || status?.status === "revoked" || status?.status === "expired" ? (
              <>
                <WarningCircle size={32} weight="fill" className="mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-medium text-black dark:text-white mb-1">
                  {status.status === "revoked" ? "Access Revoked" : status.status === "expired" ? "Session Expired" : "Connection Error"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {status?.errorMessage || "Please reconnect your Microsoft account."}
                </p>
              </>
            ) : (
              <>
                <OneDriveIcon className="size-8 mx-auto opacity-50 mb-3" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Connect your Microsoft account to import OneDrive files.
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
              <MicrosoftOutlookLogo size={16} weight="fill" />
              Connect Microsoft Account
            </button>
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
        Supports Word, Excel, PowerPoint, PDF, and text files (max 50MB).
      </p>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Disconnect OneDrive
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to disconnect? This will:
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                <li>Remove access to your OneDrive files</li>
                <li>Delete all indexed documents from your account</li>
              </ul>
              <p className="mt-2 text-xs">
                Your original OneDrive files will not be affected.
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
