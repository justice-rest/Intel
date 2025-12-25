"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/lib/user-store/provider"
import { toast } from "sonner"
import { Spinner } from "@phosphor-icons/react"

interface WelcomePopupProps {
  isOpen: boolean
  onComplete: () => void
}

export function WelcomePopup({ isOpen, onComplete }: WelcomePopupProps) {
  const { updateUser } = useUser()
  const [firstName, setFirstName] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim()) {
      toast.error("Please enter your name")
      return
    }

    setIsSubmitting(true)

    try {
      // Update user with first_name and mark welcome as completed
      await updateUser({
        first_name: firstName.trim(),
        welcome_completed: true,
      })

      // If notes are provided, save them to AI Memory
      if (notes.trim()) {
        const response = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: notes.trim(),
            memory_type: "explicit",
            importance_score: 0.9,
            metadata: {
              category: "user_info",
              context: "User's welcome notes - things they want the AI to remember",
            },
          }),
        })

        if (!response.ok) {
          console.warn("Failed to save notes to memory, but continuing...")
        }
      }

      onComplete()
    } catch (error) {
      console.error("Error completing welcome:", error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        hasCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome!</DialogTitle>
          <DialogDescription>
            Let&apos;s get to know you a little better.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">What&apos;s your name?</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes for me{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you'd like me to remember about you or your work?"
              rows={3}
              disabled={isSubmitting}
            />
            <p className="text-muted-foreground text-xs">
              These notes will be saved to my memory so I can personalize our
              conversations.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !firstName.trim()}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 size-4 animate-spin" />
                Getting started...
              </>
            ) : (
              "Get Started"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
