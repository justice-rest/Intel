"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Sparkle,
  LightbulbFilament,
} from "@phosphor-icons/react"

interface QuizOption {
  label: string
  value: string
}

interface QuizQuestionCardProps {
  questionId: string
  level: "basic" | "intermediate" | "advanced"
  category: string
  question: string
  options: QuizOption[]
  bonusMessages: number
  answered?: boolean
  answeredCorrectly?: boolean | null
  onSubmit: (
    questionId: string,
    answer: string
  ) => Promise<{
    correct: boolean
    correctAnswer: string
    explanation: string
    bonusEarned: number
  }>
  disabled?: boolean
}

const levelColors = {
  basic: "bg-green-500/10 text-green-600 dark:text-green-400",
  intermediate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  advanced: "bg-red-500/10 text-red-600 dark:text-red-400",
}

const levelLabels = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

export function QuizQuestionCard({
  questionId,
  level,
  category,
  question,
  options,
  bonusMessages,
  answered = false,
  answeredCorrectly = null,
  onSubmit,
  disabled = false,
}: QuizQuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    correct: boolean
    correctAnswer: string
    explanation: string
    bonusEarned: number
  } | null>(null)

  const handleSubmit = async () => {
    if (!selectedAnswer || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await onSubmit(questionId, selectedAnswer)
      setResult(response)
    } catch (error) {
      console.error("Error submitting answer:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAnswered = answered || result !== null

  return (
    <Card
      className={cn(
        "transition-all",
        isAnswered && "opacity-90",
        result?.correct && "border-green-500/50",
        result?.correct === false && "border-red-500/50"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={levelColors[level]}>
              {levelLabels[level]}
            </Badge>
            <span className="text-muted-foreground text-xs">{category}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Sparkle className="size-4 text-yellow-500" weight="fill" />
            <span className="font-medium">+{bonusMessages}</span>
          </div>
        </div>
        <CardTitle className="text-base leading-snug">{question}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {options.map((option) => {
          const isSelected = selectedAnswer === option.value
          const isCorrectAnswer = result?.correctAnswer === option.value
          const wasIncorrectSelection =
            result && isSelected && !result.correct

          return (
            <button
              key={option.value}
              onClick={() => !isAnswered && setSelectedAnswer(option.value)}
              disabled={isAnswered || disabled}
              className={cn(
                "w-full rounded-lg border p-3 text-left text-sm transition-all",
                "hover:border-primary/50 hover:bg-accent/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSelected && !result && "border-primary bg-primary/10",
                isCorrectAnswer && "border-green-500 bg-green-500/10",
                wasIncorrectSelection && "border-red-500 bg-red-500/10"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    isSelected && !result && "border-primary bg-primary text-primary-foreground",
                    isCorrectAnswer && "border-green-500 bg-green-500 text-white",
                    wasIncorrectSelection && "border-red-500 bg-red-500 text-white"
                  )}
                >
                  {option.value}
                </span>
                <span className="flex-1">{option.label}</span>
                {isCorrectAnswer && (
                  <CheckCircle
                    className="size-5 text-green-500"
                    weight="fill"
                  />
                )}
                {wasIncorrectSelection && (
                  <XCircle className="size-5 text-red-500" weight="fill" />
                )}
              </div>
            </button>
          )
        })}
      </CardContent>

      {/* Result Explanation */}
      {result && (
        <CardContent className="pt-0">
          <div
            className={cn(
              "rounded-lg p-4",
              result.correct
                ? "bg-green-500/10 text-green-800 dark:text-green-200"
                : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
            )}
          >
            <div className="mb-2 flex items-center gap-2 font-medium">
              <LightbulbFilament className="size-5" weight="fill" />
              <span>
                {result.correct
                  ? `Correct! +${result.bonusEarned} bonus messages`
                  : "Not quite right"}
              </span>
            </div>
            <p className="text-sm opacity-90">{result.explanation}</p>
          </div>
        </CardContent>
      )}

      {/* Already answered indicator */}
      {answered && !result && (
        <CardContent className="pt-0">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg p-3 text-sm",
              answeredCorrectly
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            {answeredCorrectly ? (
              <>
                <CheckCircle className="size-4" weight="fill" />
                <span>You answered this correctly</span>
              </>
            ) : (
              <>
                <XCircle className="size-4" weight="fill" />
                <span>You&apos;ve already attempted this question</span>
              </>
            )}
          </div>
        </CardContent>
      )}

      {/* Submit Button */}
      {!isAnswered && (
        <CardFooter>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAnswer || isSubmitting || disabled}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Submit Answer"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
