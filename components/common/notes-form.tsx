"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { CaretLeft, SealCheck, Spinner } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect, useRef } from "react"

const TRANSITION_CONTENT = {
  ease: "easeOut",
  duration: 0.2,
}

// Convert markdown to HTML for inline rendering
function markdownToHtml(text: string): string {
  if (!text) return ""

  let html = text
    // Escape HTML first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Bold: **text** or __text__ (non-greedy, no nesting)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>')

  // Italic: *text* or _text_ (non-greedy, avoid matching bold markers)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>')
  html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em class="italic">$1</em>')

  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del class="line-through">$1</del>')

  // Inline code: `text` (no nested backticks)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted rounded px-1 py-0.5 font-mono text-xs">$1</code>')

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>')

  // Preserve newlines
  html = html.replace(/\n/g, '<br>')

  return html
}

// Convert HTML back to markdown for storage
function htmlToMarkdown(html: string): string {
  if (!html) return ""

  let text = html

  // Convert <br> and divs to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/div><div>/gi, '\n')
  text = text.replace(/<div>/gi, '\n')
  text = text.replace(/<\/div>/gi, '')

  // Convert formatting tags back to markdown
  text = text.replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**')
  text = text.replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*')
  text = text.replace(/<del[^>]*>([^<]*)<\/del>/gi, '~~$1~~')
  text = text.replace(/<code[^>]*>([^<]*)<\/code>/gi, '`$1`')
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)')

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

  // Clean up multiple newlines at start
  text = text.replace(/^\n+/, '')

  return text
}

// Get cursor offset from start of element's text content
function getCursorOffset(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return -1

  const range = selection.getRangeAt(0)
  if (!element.contains(range.startContainer)) return -1

  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.startContainer, range.startOffset)
  return preCaretRange.toString().length
}

// Set cursor at specific text offset
function setCursorOffset(element: HTMLElement, targetOffset: number) {
  if (targetOffset < 0) return

  const selection = window.getSelection()
  if (!selection) return

  let currentOffset = 0

  function traverse(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0
      if (currentOffset + len >= targetOffset) {
        const range = document.createRange()
        range.setStart(node, targetOffset - currentOffset)
        range.collapse(true)
        selection!.removeAllRanges()
        selection!.addRange(range)
        return true
      }
      currentOffset += len
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (traverse(child)) return true
      }
    }
    return false
  }

  if (!traverse(element)) {
    // Fallback: place cursor at end
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
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
  const editorRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const isComposingRef = useRef(false)

  // Initialize and update editor content
  useEffect(() => {
    if (editorRef.current) {
      const content = existingNote || ""
      editorRef.current.innerHTML = markdownToHtml(content)
      setNote(content)
    }
  }, [existingNote])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  if (!isSupabaseEnabled) {
    return null
  }

  const handleClose = () => {
    setNote("")
    setStatus("idle")
    if (editorRef.current) {
      editorRef.current.innerHTML = ""
    }
    onClose()
  }

  const processMarkdown = () => {
    if (!editorRef.current || isComposingRef.current) return

    const cursorOffset = getCursorOffset(editorRef.current)
    const markdown = htmlToMarkdown(editorRef.current.innerHTML)

    setNote(markdown)

    const newHtml = markdownToHtml(markdown)
    const currentHtml = editorRef.current.innerHTML

    // Only update if HTML actually changed (prevents unnecessary reflows)
    if (currentHtml !== newHtml) {
      editorRef.current.innerHTML = newHtml
      setCursorOffset(editorRef.current, cursorOffset)
    }
  }

  const handleInput = () => {
    if (!editorRef.current) return

    // Update note state immediately for button enable/disable
    const markdown = htmlToMarkdown(editorRef.current.innerHTML)
    setNote(markdown)

    // Debounce the markdown processing to avoid flickering
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(processMarkdown, 150)
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = () => {
    isComposingRef.current = false
    processMarkdown()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()

        const br = document.createElement('br')
        range.insertNode(br)

        // Move cursor after the br
        range.setStartAfter(br)
        range.setEndAfter(br)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      handleInput()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    handleInput()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!note.trim()) return

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

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
            <div className="relative flex-1 overflow-hidden">
              {!hasContent && (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 text-sm leading-[1.4] select-none"
                >
                  Write your notes here...
                </span>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="text-foreground h-full w-full overflow-y-auto bg-transparent px-4 py-3.5 text-sm outline-none"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              />
            </div>
            <div className="flex shrink-0 justify-between pt-2 pr-3 pb-3 pl-2">
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
                disabled={status === "submitting" || !hasContent}
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
