"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { NotesForm } from "@/components/common/notes-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { useState, useEffect, useCallback, ReactNode } from "react"

type NotesTriggerProps = {
  messageId: string
  children: ReactNode
}

export function NotesTrigger({ messageId, children }: NotesTriggerProps) {
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

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="bg-background border-border">
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="text-muted-foreground text-sm">Loading...</div>
            </div>
          ) : (
            <NotesForm
              messageId={messageId}
              existingNote={existingNote}
              onClose={handleClose}
            />
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="[&>button:last-child]:bg-background overflow-hidden p-0 shadow-xs sm:max-w-md [&>button:last-child]:top-3.5 [&>button:last-child]:right-3 [&>button:last-child]:rounded-full [&>button:last-child]:p-1">
        <DialogHeader className="sr-only">
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="text-muted-foreground text-sm">Loading...</div>
          </div>
        ) : (
          <NotesForm
            messageId={messageId}
            existingNote={existingNote}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
