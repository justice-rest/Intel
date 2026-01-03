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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { useCollaborators } from "@/lib/collaboration"
import { useUser } from "@/lib/user-store/provider"
import { CollaboratorBadge } from "./collaborator-badge"
import { cn } from "@/lib/utils"
import {
  UsersThree,
  DotsThree,
  Trash,
  PencilSimple,
  Eye,
  Spinner,
  SignOut,
} from "@phosphor-icons/react"

type DialogManageCollaboratorsProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export function DialogManageCollaborators({
  isOpen,
  setIsOpen,
}: DialogManageCollaboratorsProps) {
  const isMobile = useBreakpoint(768)
  const { user } = useUser()
  const {
    collaborators,
    isOwner,
    isLoading,
    updateCollaboratorRole,
    removeCollaborator,
  } = useCollaborators()

  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const handleRoleChange = async (
    userId: string,
    role: "editor" | "viewer"
  ) => {
    setActionInProgress(userId)
    try {
      await updateCollaboratorRole(userId, role)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRemove = async (userId: string) => {
    setActionInProgress(userId)
    try {
      await removeCollaborator(userId)
    } finally {
      setActionInProgress(null)
    }
  }

  // Get display name with fallback
  const getDisplayName = (collab: typeof collaborators[0]) => {
    if (collab.user?.display_name) return collab.user.display_name
    if (collab.user?.email) return collab.user.email.split("@")[0]
    return "Unknown"
  }

  // Get initials for avatar
  const getInitials = (collab: typeof collaborators[0]) => {
    const name = getDisplayName(collab)
    return name.charAt(0).toUpperCase()
  }

  const content = (
    <div className="px-5 py-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : collaborators.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No collaborators yet
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {collaborators.map((collab) => {
              const isCurrentUser = collab.user_id === user?.id
              const canManage = isOwner && !isCurrentUser && collab.role !== "owner"
              const isProcessing = actionInProgress === collab.user_id
              const displayName = getDisplayName(collab)

              return (
                <div
                  key={collab.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-colors",
                    isCurrentUser ? "bg-accent/50" : "hover:bg-accent/30"
                  )}
                >
                  {/* Avatar */}
                  <div className="size-10 rounded-full overflow-hidden bg-primary flex items-center justify-center shrink-0">
                    {collab.user?.profile_image ? (
                      <img
                        src={collab.user.profile_image}
                        alt={displayName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-primary-foreground">
                        {getInitials(collab)}
                      </span>
                    )}
                  </div>

                  {/* Name and email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </div>
                    {collab.user?.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {collab.user.email}
                      </div>
                    )}
                  </div>

                  {/* Role badge */}
                  <CollaboratorBadge role={collab.role} />

                  {/* Actions */}
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Spinner className="size-4 animate-spin" />
                          ) : (
                            <DotsThree size={16} weight="bold" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {collab.role !== "editor" && (
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(collab.user_id, "editor")}
                          >
                            <PencilSimple size={16} className="mr-2" />
                            Make editor
                          </DropdownMenuItem>
                        )}
                        {collab.role !== "viewer" && (
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(collab.user_id, "viewer")}
                          >
                            <Eye size={16} className="mr-2" />
                            Make viewer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleRemove(collab.user_id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash size={16} className="mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Self-remove option for non-owners */}
                  {isCurrentUser && !isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemove(collab.user_id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Spinner className="size-4 animate-spin" />
                      ) : (
                        <>
                          <SignOut size={14} className="mr-1" />
                          Leave
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2.5 text-base font-semibold">
              <UsersThree size={20} weight="fill" className="text-muted-foreground" />
              Collaborators
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
              {collaborators.length} collaborator{collaborators.length !== 1 ? "s" : ""} in this conversation
            </DrawerDescription>
          </DrawerHeader>
          <div className="pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <UsersThree size={20} weight="fill" className="text-muted-foreground" />
            Collaborators
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            {collaborators.length} collaborator{collaborators.length !== 1 ? "s" : ""} in this conversation
          </DialogDescription>
        </DialogHeader>

        {content}

        <DialogFooter className="px-5 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="h-9">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
