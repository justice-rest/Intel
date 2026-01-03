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
import { Check, User } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import type { PersonaWithProfile } from "@/lib/personas"

type DialogAssignPersonaProps = {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  chatId: string
  chatTitle: string
  currentPersonaId?: string | null
  onPersonaChange: (personaId: string | null) => void
}

export function DialogAssignPersona({
  isOpen,
  setIsOpen,
  chatId,
  chatTitle,
  currentPersonaId,
  onPersonaChange,
}: DialogAssignPersonaProps) {
  const [personas, setPersonas] = useState<PersonaWithProfile[]>([])
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  // Fetch personas when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchPersonas()
      setSelectedPersonaId(currentPersonaId || null)
    }
  }, [isOpen, currentPersonaId])

  const fetchPersonas = async () => {
    setIsFetching(true)
    try {
      const response = await fetch("/api/personas")
      if (response.ok) {
        const data = await response.json()
        setPersonas(data.personas || [])
      }
    } catch (error) {
      console.error("Error fetching personas:", error)
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
          persona_id: selectedPersonaId,
        }),
      })

      if (response.ok) {
        onPersonaChange(selectedPersonaId)
        setIsOpen(false)
        if (selectedPersonaId) {
          const persona = personas.find((p) => p.id === selectedPersonaId)
          toast({
            title: "Persona assigned",
            description: `Now using "${persona?.name}"`,
          })
        } else {
          toast({
            title: "Persona removed",
            description: "Chat will use default behavior",
          })
        }
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update persona",
        })
      }
    } catch (error) {
      console.error("Error updating chat persona:", error)
      toast({
        title: "Error",
        description: "Failed to update persona",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Truncate long chat titles for display
  const truncatedTitle = chatTitle.length > 50 ? `${chatTitle.slice(0, 50)}...` : chatTitle

  // Render persona icon
  const renderIcon = (iconName: string, color: string) => {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <span style={{ color }}>
          <User className="w-4 h-4" weight="fill" />
        </span>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <User size={20} weight="fill" className="text-muted-foreground" />
            Assign Persona
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 mt-1.5 leading-relaxed">
            Choose how the AI should respond in &quot;{truncatedTitle}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-2">
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-1 py-1">
                {/* Default option (no persona) */}
                <button
                  type="button"
                  onClick={() => setSelectedPersonaId(null)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                    selectedPersonaId === null
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                    selectedPersonaId === null
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}>
                    {selectedPersonaId === null && (
                      <Check size={12} className="text-primary-foreground" weight="bold" />
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">Default</span>
                    <p className="text-xs text-muted-foreground truncate">
                      Standard fundraising assistant
                    </p>
                  </div>
                </button>

                {/* Persona list */}
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(persona.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                      selectedPersonaId === persona.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      selectedPersonaId === persona.id
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {selectedPersonaId === persona.id && (
                        <Check size={12} className="text-primary-foreground" weight="bold" />
                      )}
                    </div>
                    {renderIcon(persona.icon, persona.color)}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{persona.name}</span>
                      {persona.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {persona.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

                {/* Empty state */}
                {personas.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      No personas created yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create personas in Settings
                    </p>
                  </div>
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
