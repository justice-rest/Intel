"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/lib/user-store/provider"
import { toast } from "sonner"
import { Spinner, Sparkle, Brain, ArrowRight } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"

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
        className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-2xl"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* Main card with subtle gradient border effect */}
              <div className="relative rounded-2xl bg-gradient-to-b from-primary/5 to-transparent p-[1px]">
                <div className="rounded-2xl bg-background/95 backdrop-blur-xl">
                  {/* Header section with brand accent */}
                  <div className="relative px-8 pt-10 pb-6">
                    {/* Decorative sparkle */}
                    <motion.div
                      className="absolute top-6 right-8 text-primary/20"
                      animate={{ rotate: [0, 15, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkle className="size-6" weight="fill" />
                    </motion.div>

                    {/* Welcome badge */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium tracking-wide mb-4"
                    >
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      Getting Started
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="text-2xl font-semibold tracking-tight text-foreground"
                      style={{ fontFamily: 'rb-freigeist-neue, system-ui, sans-serif' }}
                    >
                      Welcome to Rōmy
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25, duration: 0.4 }}
                      className="mt-2 text-muted-foreground text-sm leading-relaxed"
                    >
                      Let&apos;s personalize your experience. This only takes a moment.
                    </motion.p>
                  </div>

                  {/* Form section */}
                  <form onSubmit={handleSubmit} className="px-8 pb-8">
                    <div className="space-y-5">
                      {/* Name input */}
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="space-y-2"
                      >
                        <label
                          htmlFor="firstName"
                          className="text-sm font-medium text-foreground flex items-center gap-2"
                        >
                          What should I call you?
                        </label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Your first name"
                          autoFocus
                          disabled={isSubmitting}
                          className="h-11 bg-muted/50 border-muted-foreground/10 focus:border-primary/30 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                        />
                      </motion.div>

                      {/* Notes textarea */}
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                        className="space-y-2"
                      >
                        <label
                          htmlFor="notes"
                          className="text-sm font-medium text-foreground flex items-center gap-2"
                        >
                          <Brain className="size-4 text-muted-foreground" weight="duotone" />
                          Notes for my memory
                          <span className="text-muted-foreground/60 font-normal text-xs">(optional)</span>
                        </label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Tell me about your organization, your role, or anything you'd like me to remember..."
                          rows={3}
                          disabled={isSubmitting}
                          className="bg-muted/50 border-muted-foreground/10 focus:border-primary/30 focus:ring-primary/20 transition-all resize-none placeholder:text-muted-foreground/50"
                        />
                        <p className="text-muted-foreground/70 text-xs flex items-start gap-1.5">
                          <Sparkle className="size-3 mt-0.5 shrink-0" weight="fill" />
                          I&apos;ll use this to personalize our conversations and research.
                        </p>
                      </motion.div>
                    </div>

                    {/* Submit button */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                      className="mt-6"
                    >
                      <Button
                        type="submit"
                        className="w-full h-11 text-sm font-medium bg-primary hover:bg-primary/90 transition-all group"
                        disabled={isSubmitting || !firstName.trim()}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <Spinner className="size-4 animate-spin" />
                            Getting started...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Let&apos;s Go
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
                          </span>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
