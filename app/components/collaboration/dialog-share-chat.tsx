"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useCollaborators } from "@/lib/collaboration"
import { getRoleLabel } from "@/lib/collaboration/types"
import { cn } from "@/lib/utils"
import {
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  Trash,
  Eye,
  PencilSimple,
  Spinner,
  Lock,
} from "@phosphor-icons/react"

type DialogShareChatProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  chatTitle: string
}

export function DialogShareChat({
  isOpen,
  setIsOpen,
  chatTitle,
}: DialogShareChatProps) {
  const isMobile = useBreakpoint(768)
  const { shareLinks, isOwner, createShareLink, revokeShareLink, isLoading } =
    useCollaborators()

  // Create link form state
  const [grantsRole, setGrantsRole] = useState<"editor" | "viewer">("viewer")
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  const handleCreateLink = async () => {
    setIsCreating(true)
    try {
      await createShareLink({
        grants_role: grantsRole,
        password: usePassword ? password : undefined,
        label: label.trim() || undefined,
      })
      // Reset form
      setGrantsRole("viewer")
      setUsePassword(false)
      setPassword("")
      setLabel("")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyLink = async (linkUrl: string, linkId: string) => {
    await navigator.clipboard.writeText(linkUrl)
    setCopiedLinkId(linkId)
    setTimeout(() => setCopiedLinkId(null), 2000)
  }

  const handleRevokeLink = async (linkId: string) => {
    await revokeShareLink(linkId)
  }

  const truncatedTitle =
    chatTitle.length > 40 ? `${chatTitle.slice(0, 40)}...` : chatTitle

  const content = (
    <>
      {/* Create Link Section */}
      {isOwner && (
        <div className="px-5 py-4 border-b">
          <Label className="text-sm font-medium mb-3 block">
            Create share link
          </Label>

          <div className="space-y-4">
            {/* Role Selection */}
            <div className="flex items-center gap-2">
              <Button
                variant={grantsRole === "viewer" ? "default" : "outline"}
                size="sm"
                onClick={() => setGrantsRole("viewer")}
                className="flex-1 gap-2"
              >
                <Eye size={16} />
                Can view
              </Button>
              <Button
                variant={grantsRole === "editor" ? "default" : "outline"}
                size="sm"
                onClick={() => setGrantsRole("editor")}
                className="flex-1 gap-2"
              >
                <PencilSimple size={16} />
                Can edit
              </Button>
            </div>

            {/* Password Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-muted-foreground" />
                <Label htmlFor="password-toggle" className="text-sm">
                  Require password
                </Label>
              </div>
              <Switch
                id="password-toggle"
                checked={usePassword}
                onCheckedChange={setUsePassword}
              />
            </div>

            {/* Password Input */}
            {usePassword && (
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9"
              />
            )}

            {/* Label Input */}
            <Input
              placeholder="Link label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-9"
            />

            {/* Create Button */}
            <Button
              onClick={handleCreateLink}
              disabled={isCreating || (usePassword && !password.trim())}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Spinner className="size-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon size={16} className="mr-2" />
                  Create Link
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Active Links Section */}
      <div className="px-5 py-4">
        <Label className="text-sm font-medium mb-3 block">
          Active share links
        </Label>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : shareLinks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No active share links
          </div>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {shareLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {link.has_password && (
                        <Lock size={12} className="text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {link.label || "Untitled link"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{getRoleLabel(link.grants_role)}</span>
                      <span>·</span>
                      <span>
                        {link.use_count} use{link.use_count !== 1 ? "s" : ""}
                      </span>
                      {link.max_uses && (
                        <>
                          <span>·</span>
                          <span>max {link.max_uses}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleCopyLink(link.full_url, link.id)}
                    >
                      {copiedLinkId === link.id ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleRevokeLink(link.id)}
                      >
                        <Trash size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2.5 text-base font-semibold">
              <Users size={20} weight="fill" className="text-muted-foreground" />
              Share Chat
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
              Share &quot;{truncatedTitle}&quot; with collaborators.
            </DrawerDescription>
          </DrawerHeader>
          <div className="pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[450px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <Users size={20} weight="fill" className="text-muted-foreground" />
            Share Chat
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            Share &quot;{truncatedTitle}&quot; with collaborators.
          </DialogDescription>
        </DialogHeader>

        {content}

        <DialogFooter className="px-5 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
