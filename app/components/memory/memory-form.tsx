"use client"

import { useState } from "react"
import { useMemory } from "@/lib/memory-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { X } from "@phosphor-icons/react"

interface MemoryFormProps {
  onClose: () => void
}

export function MemoryForm({ onClose }: MemoryFormProps) {
  const { createMemory } = useMemory()
  const [content, setContent] = useState("")
  const [tags, setTags] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await createMemory(content, {
        tags: tagArray.length > 0 ? tagArray : ["user-added"],
        context: "Manually added by user",
      })

      onClose()
    } catch (error) {
      console.error("Failed to create memory:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Memory</DialogTitle>
          <DialogDescription>
            Save an important fact or preference that the AI should remember about you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Memory Content *</Label>
            <Textarea
              id="content"
              placeholder="e.g., My name is Sarah and I prefer concise responses"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              What should the AI remember? Be specific and concise.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              placeholder="e.g., name, preferences, work"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated tags to help organize this memory
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !content.trim()}>
              {isSubmitting ? "Saving..." : "Save Memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
