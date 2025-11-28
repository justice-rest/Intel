"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { CaretLeft, SealCheck, Spinner } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect } from "react"
import { Streamdown, type StreamdownProps } from "streamdown"

const TRANSITION_CONTENT = {
  ease: "easeOut",
  duration: 0.2,
}

// Custom components for inline-only markdown (no block elements)
const NOTES_MARKDOWN_COMPONENTS: StreamdownProps["components"] = {
  // Allow inline formatting
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  del: ({ children }) => <del className="line-through">{children}</del>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  // Block elements render as plain inline text
  h1: ({ children }) => <span>{children}</span>,
  h2: ({ children }) => <span>{children}</span>,
  h3: ({ children }) => <span>{children}</span>,
  h4: ({ children }) => <span>{children}</span>,
  h5: ({ children }) => <span>{children}</span>,
  h6: ({ children }) => <span>{children}</span>,
  blockquote: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <span>{children}</span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>{children} </span>,
  hr: () => null,
  table: ({ children }) => <span>{children}</span>,
  thead: ({ children }) => <span>{children}</span>,
  tbody: ({ children }) => <span>{children}</span>,
  tr: ({ children }) => <span>{children}</span>,
  th: ({ children }) => <span>{children} </span>,
  td: ({ children }) => <span>{children} </span>,
  p: ({ children }) => <span>{children}</span>,
}

type NotesFormProps = {
  messageId: string
  existingNote?: string | null
  onClose: () => void
}

export function NotesForm({ messageId, existingNote, onClose }: NotesFormProps) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")
  const [note, setNote] = useState(existingNote || "")

  useEffect(() => {
    if (existingNote) {
      setNote(existingNote)
    }
  }, [existingNote])

  if (!isSupabaseEnabled) {
    return null
  }

  const handleClose = () => {
    setNote("")
    setStatus("idle")
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!note.trim()) return

    setStatus("submitting")

    try {
      const response = await fetch("/api/message-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId,
          content: note,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast({
          title: data.error || "Failed to save note",
          status: "error",
        })
        setStatus("error")
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 800))

      setStatus("success")

      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (error) {
      toast({
        title: `Error saving note: ${error}`,
        status: "error",
      })
      setStatus("error")
    }
  }

  const hasContent = note.trim().length > 0

  return (
    <div className="h-[200px] w-full">
      <AnimatePresence mode="popLayout">
        {status === "success" ? (
          <motion.div
            key="success"
            className="flex h-[200px] w-full flex-col items-center justify-center"
            initial={{ opacity: 0, y: -10, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(2px)" }}
            transition={TRANSITION_CONTENT}
          >
            <div className="rounded-full bg-green-500/10 p-1">
              <SealCheck className="size-6 text-green-500" />
            </div>
            <p className="text-foreground mt-3 mb-1 text-center text-sm font-medium">
              Note saved!
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            className="flex h-full flex-col"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: -10, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(2px)" }}
            transition={TRANSITION_CONTENT}
          >
            <motion.span
              aria-hidden="true"
              initial={{
                opacity: 1,
              }}
              animate={{
                opacity: note ? 0 : 1,
              }}
              transition={{
                duration: 0,
              }}
              className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 text-sm leading-[1.4] select-none"
            >
              Write your notes here...
            </motion.span>
            <textarea
              className="text-foreground h-full min-h-[80px] w-full flex-1 resize-none rounded-md bg-transparent px-4 py-3.5 text-sm outline-hidden"
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={status === "submitting"}
            />
            {hasContent && (
              <div className="border-border/50 border-t px-4 py-2">
                <div className="text-foreground/90 max-h-[50px] overflow-y-auto text-sm leading-relaxed">
                  <Streamdown components={NOTES_MARKDOWN_COMPONENTS}>
                    {note}
                  </Streamdown>
                </div>
              </div>
            )}
            <div
              key="close"
              className="flex justify-between pt-2 pr-3 pb-3 pl-2"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                aria-label="Close"
                disabled={status === "submitting"}
                className="rounded-lg"
              >
                <CaretLeft size={16} className="text-foreground" />
              </Button>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                aria-label="Save note"
                className="rounded-lg"
                disabled={status === "submitting" || !note.trim()}
              >
                <AnimatePresence mode="popLayout">
                  {status === "submitting" ? (
                    <motion.span
                      key="submitting"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={TRANSITION_CONTENT}
                      className="inline-flex items-center gap-2"
                    >
                      <Spinner className="size-4 animate-spin" />
                      Saving...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="save"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={TRANSITION_CONTENT}
                    >
                      Save
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
