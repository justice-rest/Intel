"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  GraduationCap,
  Spinner,
  Trophy,
  Gift,
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
  const [maxBonusCredits, setMaxBonusCredits] = useState(100)
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
      setMaxBonusCredits(data.maxBonusCredits || 100)
    } catch (error) {
      console.error("Error fetching quiz:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchQuizData()
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

  const handleOptionClick = (value: string) => {
    if (!isSubmitting && !result) {
      setSelectedAnswer(value)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="flex items-center justify-center py-12 bg-white dark:bg-[#1a1a1a]">
            <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Already answered today
  if (question?.answered && !result) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="p-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
            <h2 className="text-base font-semibold mb-2 text-black dark:text-white">
              Daily Quiz Complete
            </h2>

            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Bonus</span>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {currentBonusBalance}/{maxBonusCredits}
              </span>
            </div>

            <hr className="border-gray-200 dark:border-[#333] my-2" />

            <div className="flex flex-col items-center py-4">
              <Trophy className="size-12 text-yellow-500 mb-2" weight="fill" />
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ve already answered today&apos;s question.<br />
                Come back tomorrow for a new one!
              </p>
            </div>

            <button
              type="button"
              className="w-full h-11 rounded bg-[rgb(255,187,16)] hover:bg-transparent border border-[rgb(255,187,16)] text-black dark:hover:text-white font-semibold text-sm transition-all"
              onClick={onClose}
            >
              Got it!
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Show result after answering
  if (result) {
    const correctOption = question?.options.find(o => o.value === result.correctAnswer)

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
            <h2 className="text-base font-semibold mb-2 text-black dark:text-white">
              {result.correct ? "Correct!" : "Incorrect"}
            </h2>

            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Result</span>
              <span className={`text-sm font-semibold ${result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {result.bonusChange > 0 ? "+" : ""}{result.bonusChange} bonus
              </span>
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {result.newBonusBalance}/{maxBonusCredits}
              </span>
            </div>

            <hr className="border-gray-200 dark:border-[#333] my-2" />

            {!result.correct && (
              <div className="bg-red-50 dark:bg-[#2a1515] border border-red-200 dark:border-red-900 rounded p-2.5 mb-2.5 text-sm text-red-800 dark:text-red-300">
                <span className="font-semibold">Correct answer:</span> {correctOption?.label}
              </div>
            )}

            <div className="bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded p-2.5 mb-3">
              <div className="text-sm font-semibold text-black dark:text-white mb-1 flex items-center">
                <GraduationCap size={14} weight="fill" className="mr-1" />
                Why?
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {result.explanation}
              </p>
            </div>

            <button
              type="button"
              className="w-full h-11 rounded bg-[rgb(255,187,16)] hover:bg-transparent border border-[rgb(255,187,16)] text-black dark:hover:text-white font-semibold text-sm transition-all"
              onClick={onClose}
            >
              Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Show question
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]">
          <h2 className="text-base font-semibold mb-2 text-black dark:text-white">
            Daily Quiz
          </h2>

          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Bonus</span>
            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
              {currentBonusBalance}/{maxBonusCredits}
            </span>
          </div>

          <hr className="border-gray-200 dark:border-[#333] my-2" />

          {question && (
            <>
              <p className="text-sm font-medium text-black dark:text-white mb-3 leading-relaxed">
                {question.question}
              </p>

              <div className="space-y-2 mb-3">
                {question.options.map((option) => (
                  <div
                    key={option.value}
                    className={`p-2.5 border rounded cursor-pointer transition-all ${
                      selectedAnswer === option.value
                        ? "border-2 border-black dark:border-green-500"
                        : "border-gray-300 dark:border-[#444]"
                    }`}
                    onClick={() => handleOptionClick(option.value)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedAnswer === option.value
                            ? "border-green-500"
                            : "border-gray-400 dark:border-gray-600"
                        }`}
                      >
                        {selectedAnswer === option.value && (
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                      </div>
                      <span className="text-sm text-black dark:text-white">
                        {option.value}. {option.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="w-full h-11 rounded bg-[rgb(255,187,16)] hover:bg-transparent border border-[rgb(255,187,16)] text-black dark:hover:text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-2"
                onClick={handleSubmit}
                disabled={!selectedAnswer || isSubmitting}
              >
                {isSubmitting ? "Checking..." : "Submit Answer"}
              </button>

              <button
                type="button"
                className="w-full h-9 rounded bg-transparent border border-gray-300 dark:border-[#444] text-black dark:text-white font-medium text-sm transition-all hover:border-[rgb(255,187,16)]"
                onClick={onClose}
              >
                Skip
              </button>

              <div className="flex items-center justify-center mt-3 pt-3 border-t border-gray-200 dark:border-[#333]">
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                  <Gift size={18} className="mx-auto mb-1" />
                  +{question.bonusMessages} bonus for correct answer
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
