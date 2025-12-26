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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { cn } from "@/lib/utils"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Trash2,
  Mail,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  File,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <h3 className="relative mb-2 flex items-center gap-2 text-lg font-medium">
        Google Workspace
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          NEW
        </span>
      </h3>
      <p className="text-muted-foreground text-sm">
        Connect Gmail and Google Drive to let AI read your emails, draft responses, and search your documents.
      </p>
      <p className="text-muted-foreground text-sm mt-1">
        AI can only create drafts - you must manually send emails from Gmail.
      </p>

      {/* Connection Status Card */}
      <div className="mt-4 rounded-lg border p-4">
        {isConnected ? (
          <div className="space-y-4">
            {/* Connected Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-5 text-green-500" />
                <span className="font-medium">Connected</span>
                {status?.googleEmail && (
                  <span className="text-muted-foreground text-sm">
                    ({status.googleEmail})
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisconnectDialogOpen(true)}
                disabled={disconnectMutation.isPending}
              >
                <Trash2 className="mr-1 size-4" />
                Disconnect
              </Button>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Gmail Feature */}
              <div
                className={cn(
                  "rounded-lg border p-3",
                  hasGmail ? "border-green-500/30 bg-green-500/5" : "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Mail className="size-4" />
                  <span className="font-medium">Gmail</span>
                  {hasGmail && (
                    <CheckCircle className="size-3 text-green-500" />
                  )}
                </div>
                {hasGmail && (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>Pending drafts: {status?.pendingDrafts || 0}</p>
                    {status?.styleAnalyzedAt ? (
                      <p>
                        Style analyzed: {formatDate(status.styleAnalyzedAt)} ({status.emailsAnalyzed} emails)
                      </p>
                    ) : (
                      <p className="text-amber-600">Style not analyzed</p>
                    )}
                  </div>
                )}
              </div>

              {/* Drive Feature */}
              <div
                className={cn(
                  "rounded-lg border p-3",
                  hasDrive ? "border-green-500/30 bg-green-500/5" : "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="size-4" />
                  <span className="font-medium">Google Drive</span>
                  {hasDrive && (
                    <CheckCircle className="size-3 text-green-500" />
                  )}
                </div>
                {hasDrive && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Indexed documents: {driveDocuments.length}
                      </span>
                      {driveDocuments.length > 0 && (
                        <button
                          onClick={() => setShowDriveDocuments(!showDriveDocuments)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {showDriveDocuments ? "Hide" : "Show"}
                          {showDriveDocuments ? (
                            <ChevronUp className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <GoogleDrivePicker
                      onFilesImported={() => {
                        queryClient.invalidateQueries({ queryKey: ["drive-documents"] })
                      }}
                    />
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
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Indexed Documents</h4>
                    <span className="text-xs text-muted-foreground">
                      {driveDocuments.length} file{driveDocuments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {driveDocuments.map((doc) => (
                      <div
                        key={doc.drive_file_id}
                        className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 group"
                      >
                        <File className="size-4 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">{doc.drive_file_name}</span>
                        <Badge
                          variant={
                            doc.status === "ready"
                              ? "default"
                              : doc.status === "processing"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {doc.status}
                        </Badge>
                        <button
                          onClick={() => {
                            setDeletingDocId(doc.drive_file_id)
                            deleteDocumentMutation.mutate(doc.drive_file_id)
                          }}
                          disabled={deletingDocId === doc.drive_file_id}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                        >
                          {deletingDocId === doc.drive_file_id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            {hasGmail && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeStyleMutation.mutate()}
                  disabled={analyzeStyleMutation.isPending}
                >
                  {analyzeStyleMutation.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 size-4" />
                  )}
                  {status?.styleAnalyzedAt ? "Re-analyze Style" : "Analyze Writing Style"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            {status?.status === "error" || status?.status === "revoked" ? (
              <>
                <AlertCircle className="size-8 text-amber-500 mb-2" />
                <p className="font-medium">
                  {status.status === "revoked"
                    ? "Access Revoked"
                    : "Connection Error"}
                </p>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  {status.errorMessage || "Please reconnect your Google account."}
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  <Mail className="size-6 text-muted-foreground" />
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Connect your Google account to enable Gmail and Drive features.
                </p>
              </>
            )}
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Connect Google Account
            </Button>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your Google account? This will:
              <ul className="mt-2 list-disc pl-4 space-y-1">
                <li>Remove access to Gmail and Google Drive</li>
                <li>Delete your stored writing style profile</li>
                <li>Remove all indexed Drive documents</li>
              </ul>
              <p className="mt-2">
                Existing email drafts in Gmail will not be affected.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
