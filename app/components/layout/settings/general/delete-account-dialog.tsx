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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { Warning } from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DeletionSummary {
  chatCount: number
  messageCount: number
  memoryCount: number
  fileCount: number
  crmConstituentCount: number
}

interface SubscriptionInfo {
  hasSubscription: boolean
  status: string | null
  tier: string | null
  willBeCanceled: boolean
}

const CONFIRMATION_STRING = "DELETE MY ACCOUNT"

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DeletionSummary | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [canDelete, setCanDelete] = useState(true)
  const [blockers, setBlockers] = useState<Array<{ code: string; message: string }>>([])

  const isConfirmed = confirmation === CONFIRMATION_STRING

  // Fetch deletion summary when dialog opens
  useEffect(() => {
    if (open) {
      setConfirmation("")
      setError(null)
      fetchDeletionSummary()
    }
  }, [open])

  const fetchDeletionSummary = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user/account")
      if (!response.ok) {
        throw new Error("Failed to fetch account information")
      }
      const data = await response.json()
      setSummary(data.summary)
      setSubscription(data.subscription)
      setCanDelete(data.canDelete)
      setBlockers(data.blockers || [])
    } catch (err) {
      console.error("Error fetching deletion summary:", err)
      // Still allow deletion attempt even if summary fails
      setCanDelete(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to delete account")
        return
      }

      // Clear local storage
      await clearAllIndexedDBStores()

      // Close dialog
      onOpenChange(false)

      // Show success toast
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
        status: "success",
      })

      // Redirect to goodbye page
      window.location.href = "/goodbye"
    } catch (err) {
      console.error("Deletion error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Warning className="size-5" />
            Delete Account?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will permanently delete your account and all associated data:</p>

              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : summary ? (
                <ul className="list-disc ml-5 space-y-1 text-sm">
                  {summary.chatCount > 0 && (
                    <li>{summary.chatCount} conversation{summary.chatCount !== 1 ? "s" : ""} and {summary.messageCount} message{summary.messageCount !== 1 ? "s" : ""}</li>
                  )}
                  {summary.memoryCount > 0 && (
                    <li>{summary.memoryCount} AI memor{summary.memoryCount !== 1 ? "ies" : "y"}</li>
                  )}
                  {summary.fileCount > 0 && (
                    <li>{summary.fileCount} uploaded file{summary.fileCount !== 1 ? "s" : ""}</li>
                  )}
                  {summary.crmConstituentCount > 0 && (
                    <li>{summary.crmConstituentCount} CRM contact{summary.crmConstituentCount !== 1 ? "s" : ""}</li>
                  )}
                  <li>Your profile and preferences</li>
                </ul>
              ) : (
                <ul className="list-disc ml-5 space-y-1 text-sm">
                  <li>All conversations and messages</li>
                  <li>All AI memories</li>
                  <li>All uploaded files</li>
                  <li>All CRM integrations and synced data</li>
                  <li>Your profile and preferences</li>
                </ul>
              )}

              {subscription?.willBeCanceled && (
                <p className="text-amber-600 dark:text-amber-500 text-sm font-medium">
                  Your {subscription.tier} subscription will be canceled immediately.
                </p>
              )}

              {blockers.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                  <p className="text-destructive text-sm font-medium">Cannot delete account:</p>
                  <ul className="list-disc ml-5 mt-1 text-sm text-destructive">
                    {blockers.map((blocker, i) => (
                      <li key={i}>{blocker.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {canDelete && blockers.length === 0 && (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="confirmation" className="text-sm">
                Type <span className="font-mono font-semibold">{CONFIRMATION_STRING}</span> to confirm:
              </Label>
              <Input
                id="confirmation"
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value)
                  setError(null)
                }}
                placeholder={CONFIRMATION_STRING}
                className={error ? "border-destructive" : ""}
                disabled={isDeleting}
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {canDelete && blockers.length === 0 && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Forever"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
