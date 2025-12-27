"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useUser } from "@/lib/user-store/provider"
import { SignOut, DownloadSimple, Trash, Warning } from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { DeleteAccountDialog } from "./delete-account-dialog"

type ExportMode = "all" | "selective"
type ExportSection = "profile" | "chats" | "memories" | "crm"

export function AccountManagement() {
  const { signOut } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportMode, setExportMode] = useState<ExportMode>("all")
  const [selectedSections, setSelectedSections] = useState<ExportSection[]>([
    "profile",
    "chats",
    "memories",
    "crm",
  ])

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
      const sections = exportMode === "all" ? ["all"] : selectedSections

      const response = await fetch("/api/user/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
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

  const toggleSection = (section: ExportSection) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    )
  }

  return (
    <div className="space-y-6">
      {/* Sign Out Section */}
      <div className="flex items-center justify-between pb-2">
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

      {/* Data Export Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DownloadSimple className="size-4" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of your data in JSON format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={exportMode}
            onValueChange={(value: string) => setExportMode(value as ExportMode)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="export-all" />
              <Label htmlFor="export-all" className="font-normal cursor-pointer">
                All data (profile, conversations, memories, CRM)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="selective" id="export-selective" />
              <Label htmlFor="export-selective" className="font-normal cursor-pointer">
                Select categories
              </Label>
            </div>
          </RadioGroup>

          {exportMode === "selective" && (
            <div className="ml-6 space-y-2 border-l pl-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-profile"
                  checked={selectedSections.includes("profile")}
                  onCheckedChange={() => toggleSection("profile")}
                />
                <Label htmlFor="section-profile" className="text-sm font-normal cursor-pointer">
                  Profile & preferences
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-chats"
                  checked={selectedSections.includes("chats")}
                  onCheckedChange={() => toggleSection("chats")}
                />
                <Label htmlFor="section-chats" className="text-sm font-normal cursor-pointer">
                  Conversations
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-memories"
                  checked={selectedSections.includes("memories")}
                  onCheckedChange={() => toggleSection("memories")}
                />
                <Label htmlFor="section-memories" className="text-sm font-normal cursor-pointer">
                  AI memories
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="section-crm"
                  checked={selectedSections.includes("crm")}
                  onCheckedChange={() => toggleSection("crm")}
                />
                <Label htmlFor="section-crm" className="text-sm font-normal cursor-pointer">
                  CRM data
                </Label>
              </div>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting || (exportMode === "selective" && selectedSections.length === 0)}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <DownloadSimple className="size-4 mr-2" />
                Export My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion Card */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Warning className="size-4" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            className="w-full sm:w-auto"
          >
            <Trash className="size-4 mr-2" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  )
}
