"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { Check, Sparkle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"

type KnowledgeProfileSummary = {
  id: string
  name: string
  description?: string | null
  status?: string
}

type DialogChatKnowledgeProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  chatId: string
  chatTitle: string
  currentKnowledgeProfileId?: string | null
  onKnowledgeChange: (knowledgeProfileId: string | null) => void
}

export function DialogChatKnowledge({
  isOpen,
  setIsOpen,
  chatId,
  chatTitle,
  currentKnowledgeProfileId,
  onKnowledgeChange,
}: DialogChatKnowledgeProps) {
  const [profiles, setProfiles] = useState<KnowledgeProfileSummary[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  // Fetch profiles when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchProfiles()
      setSelectedProfileId(currentKnowledgeProfileId || null)
    }
  }, [isOpen, currentKnowledgeProfileId])

  const fetchProfiles = async () => {
    setIsFetching(true)
    try {
      const response = await fetch("/api/knowledge/profile")
      if (response.ok) {
        const data = await response.json()
        setProfiles(data.profiles || [])
      }
    } catch (error) {
      console.error("Error fetching knowledge profiles:", error)
    } finally {
      setIsFetching(false)
    }
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/chat-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          knowledge_profile_id: selectedProfileId,
        }),
      })

      if (response.ok) {
        onKnowledgeChange(selectedProfileId)
        setIsOpen(false)
        if (selectedProfileId) {
          const profile = profiles.find((p) => p.id === selectedProfileId)
          toast({
            title: "Knowledge profile assigned",
            description: `Now using "${profile?.name}"`,
          })
        } else {
          toast({
            title: "Knowledge profile removed",
            description: "Chat will use default behavior",
          })
        }
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update knowledge profile",
        })
      }
    } catch (error) {
      console.error("Error updating chat knowledge profile:", error)
      toast({
        title: "Error",
        description: "Failed to update knowledge profile",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const truncatedTitle =
    chatTitle.length > 50 ? `${chatTitle.slice(0, 50)}...` : chatTitle

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <Sparkle size={20} weight="fill" className="text-muted-foreground" />
            Assign Knowledge
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            Choose a knowledge profile for &quot;{truncatedTitle}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2">
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[240px]">
              <div className="space-y-1 py-1">
                {/* No profile option (Default) */}
                <button
                  type="button"
                  onClick={() => setSelectedProfileId(null)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                    selectedProfileId === null
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      selectedProfileId === null
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {selectedProfileId === null && (
                      <Check
                        size={12}
                        className="text-primary-foreground"
                        weight="bold"
                      />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">None</span>
                </button>

                {/* Profile list */}
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                      selectedProfileId === profile.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedProfileId === profile.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selectedProfileId === profile.id && (
                        <Check
                          size={12}
                          className="text-primary-foreground"
                          weight="bold"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium">
                        {profile.name}
                      </span>
                      {profile.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {profile.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

                {/* Empty state when no profiles exist */}
                {profiles.length === 0 && (
                  <p className="text-sm text-muted-foreground/60 text-center py-4 px-3">
                    No knowledge profiles yet. Create one in Settings.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-muted/30">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1 sm:flex-none h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || isFetching}
              className="flex-1 sm:flex-none h-9"
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
