"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  GraduationCap,
  Spinner,
  Trophy,
  Warning,
} from "@phosphor-icons/react"

interface QuizQuestion {
  id: string
  level: "basic" | "intermediate" | "advanced"
  category: string
  question: string
  options: { label: string; value: string }[]
  bonusMessages: number
  penalty: number
  answered: boolean
  answeredCorrectly: boolean | null
  earnedBonus: number
}

interface QuizPopupProps {
  open: boolean
  onClose: () => void
}

export function QuizPopup({ open, onClose }: QuizPopupProps) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [currentBonusBalance, setCurrentBonusBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    correct: boolean
    correctAnswer: string
    explanation: string
    bonusChange: number
    newBonusBalance: number
  } | null>(null)

  const fetchQuizData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/quiz")
      if (!response.ok) {
        throw new Error("Failed to fetch quiz data")
      }
      const data = await response.json()
      setQuestion(data.questionOfTheDay)
      setCurrentBonusBalance(data.currentBonusBalance)
    } catch (error) {
      console.error("Error fetching quiz:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchQuizData()
      // Reset state when opening
      setSelectedAnswer(null)
      setResult(null)
    }
  }, [open, fetchQuizData])

  const handleSubmit = async () => {
    if (!selectedAnswer || !question) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answer: selectedAnswer,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit answer")
      }

      const data = await response.json()
      setResult(data)
      setCurrentBonusBalance(data.newBonusBalance)
    } catch (error) {
      console.error("Error submitting answer:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "basic":
        return "text-green-600 dark:text-green-400 bg-green-500/10"
      case "intermediate":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
      case "advanced":
        return "text-red-600 dark:text-red-400 bg-red-500/10"
      default:
        return "text-muted-foreground bg-muted"
    }
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // If question already answered today, show a message
  if (question?.answered && !result) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="size-5" weight="fill" />
              Daily Quiz Complete
            </DialogTitle>
            <DialogDescription>
              You&apos;ve already answered today&apos;s question. Come back tomorrow for a new one!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <Trophy className="size-16 text-yellow-500 mb-4" weight="fill" />
            <p className="text-lg font-semibold">
              Current Bonus: {currentBonusBalance} messages
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  // Show result after answering
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result.correct ? (
                <>
                  <CheckCircle className="size-6 text-green-500" weight="fill" />
                  <span className="text-green-600 dark:text-green-400">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="size-6 text-red-500" weight="fill" />
                  <span className="text-red-600 dark:text-red-400">Incorrect</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bonus change display */}
            <div className={cn(
              "rounded-lg p-4 text-center",
              result.correct
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            )}>
              <p className="text-2xl font-bold">
                {result.bonusChange > 0 ? "+" : ""}{result.bonusChange} bonus messages
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                New balance: {result.newBonusBalance}
              </p>
            </div>

            {/* Correct answer if wrong */}
            {!result.correct && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium mb-1">Correct Answer:</p>
                <p className="text-sm">
                  {question?.options.find(o => o.value === result.correctAnswer)?.label}
                </p>
              </div>
            )}

            {/* Explanation */}
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <GraduationCap className="size-4" />
                Why?
              </p>
              <p className="text-sm text-muted-foreground">
                {result.explanation}
              </p>
            </div>
          </div>

          <Button onClick={onClose} className="w-full mt-4">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  // Show question
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5" weight="fill" />
            Daily Quiz
          </DialogTitle>
          <DialogDescription>
            Answer correctly to earn bonus messages. Wrong answers cost you {question?.penalty || 3} messages.
          </DialogDescription>
        </DialogHeader>

        {question && (
          <div className="space-y-4">
            {/* Question metadata */}
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("rounded-full px-2 py-0.5 font-medium capitalize", getLevelColor(question.level))}>
                {question.level}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{question.category}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                +{question.bonusMessages} if correct
              </span>
            </div>

            {/* Question */}
            <p className="text-base font-medium leading-relaxed">
              {question.question}
            </p>

            {/* Options */}
            <div className="space-y-2">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedAnswer(option.value)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-all",
                    "hover:border-primary/50 hover:bg-accent/50",
                    selectedAnswer === option.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="font-medium mr-2">{option.value}.</span>
                  {option.label}
                </button>
              ))}
            </div>

            {/* Warning about penalty */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm">
              <Warning className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" weight="fill" />
              <p className="text-amber-700 dark:text-amber-300">
                Be careful! Wrong answers will deduct {question.penalty} bonus messages from your balance.
              </p>
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={!selectedAnswer || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Submit Answer"
              )}
            </Button>

            {/* Skip button */}
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-muted-foreground"
            >
              Skip for now
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
