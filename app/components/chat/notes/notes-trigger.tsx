"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { NotesForm } from "@/components/common/notes-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { NotePencil } from "@phosphor-icons/react"
import { useState, useEffect, useCallback, forwardRef } from "react"

type NotesTriggerProps = {
  messageId: string
}

export const NotesTrigger = forwardRef<HTMLButtonElement, NotesTriggerProps>(
  ({ messageId }, ref) => {
    const isMobile = useBreakpoint(768)
    const [isOpen, setIsOpen] = useState(false)
    const [existingNote, setExistingNote] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const fetchNote = useCallback(async () => {
      if (!isOpen || !messageId) return

      setIsLoading(true)
      try {
        const response = await fetch(`/api/message-notes?messageId=${messageId}`)
        const data = await response.json()

        if (data.success && data.note) {
          setExistingNote(data.note.content)
        } else {
          setExistingNote(null)
        }
      } catch (error) {
        console.error("Failed to fetch note:", error)
        setExistingNote(null)
      } finally {
        setIsLoading(false)
      }
    }, [isOpen, messageId])

    useEffect(() => {
      if (isOpen) {
        fetchNote()
      }
    }, [isOpen, fetchNote])

    if (!isSupabaseEnabled) {
      return null
    }

    const handleClose = () => {
      setIsOpen(false)
      setExistingNote(null)
    }

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setExistingNote(null)
      }
    }

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsOpen(true)
    }

    const formContent = isLoading ? (
      <div className="flex h-[200px] items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    ) : (
      <NotesForm
        messageId={messageId}
        existingNote={existingNote}
        onClose={handleClose}
      />
    )

    return (
      <>
        <button
          ref={ref}
          className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
          aria-label="Notes"
          type="button"
          onClick={handleClick}
        >
          <NotePencil className="size-4" />
        </button>

        {isMobile ? (
          <Drawer open={isOpen} onOpenChange={handleOpenChange}>
            <DrawerContent className="bg-background border-border">
              {formContent}
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="[&>button:last-child]:bg-background overflow-hidden p-0 shadow-xs sm:max-w-md [&>button:last-child]:top-3.5 [&>button:last-child]:right-3 [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
              <DialogHeader className="sr-only">
                <DialogTitle>Notes</DialogTitle>
              </DialogHeader>
              {formContent}
            </DialogContent>
          </Dialog>
        )}
      </>
    )
  }
)

NotesTrigger.displayName = "NotesTrigger"
