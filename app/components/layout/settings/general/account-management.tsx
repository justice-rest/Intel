"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useUser } from "@/lib/user-store/provider"
import { SignOut, DownloadSimple, Trash } from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { DeleteAccountDialog } from "./delete-account-dialog"

export function AccountManagement() {
  const { signOut } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleSignOut = async () => {
    try {
      await resetMessages()
      await resetChats()
      await signOut()
      await clearAllIndexedDBStores()
      window.location.href = "/auth"
    } catch (e) {
      console.error("Sign out failed:", e)
      toast({ title: "Failed to sign out", status: "error" })
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/user/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: ["all"] }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Export failed")
      }

      const result = await response.json()

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `romy-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export complete",
        description: "Your data has been downloaded.",
        status: "success",
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again",
        status: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Sign Out */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Account</h3>
          <p className="text-muted-foreground text-xs">Log out on this device</p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleSignOut}
        >
          <SignOut className="size-4" />
          <span>Sign out</span>
        </Button>
      </div>

      {/* Export Data */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Export data</h3>
          <p className="text-muted-foreground text-xs">Download all your data as JSON</p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <DownloadSimple className="size-4" />
          )}
          <span>{isExporting ? "Exporting..." : "Export"}</span>
        </Button>
      </div>

      {/* Delete Account */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-destructive">Delete account</h3>
          <p className="text-muted-foreground text-xs">Permanently delete your account and data</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash className="size-4" />
          <span>Delete</span>
        </Button>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  )
}
