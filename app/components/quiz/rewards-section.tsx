"use client"

import { useState, useEffect, useCallback } from "react"
import { QuizQuestionCard } from "./quiz-question-card"
import { QuizStats } from "./quiz-stats"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowClockwise,
  Star,
  Sparkle,
  GraduationCap,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface QuizQuestion {
  id: string
  level: "basic" | "intermediate" | "advanced"
  category: string
  question: string
  options: { label: string; value: string }[]
  bonusMessages: number
  answered: boolean
  answeredCorrectly: boolean | null
}

interface QuizData {
  questionOfTheDay: QuizQuestion
  questions: QuizQuestion[]
  stats: {
    totalQuestions: number
    totalAnswered: number
    totalCorrect: number
    totalBonusEarned: number
    currentBonusBalance: number
    monthlyBonusEarned: number
    remainingMonthlyCapacity: number
    maxMonthlyBonus: number
  }
}

export function RewardsSection() {
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"daily" | "all">("daily")
  const [levelFilter, setLevelFilter] = useState<
    "all" | "basic" | "intermediate" | "advanced"
  >("all")

  const fetchQuizData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/quiz")
      if (!response.ok) {
        throw new Error("Failed to fetch quiz data")
      }
      const data = await response.json()
      setQuizData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuizData()
  }, [fetchQuizData])

  const handleSubmitAnswer = async (questionId: string, answer: string) => {
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answer }),
    })

    if (!response.ok) {
      throw new Error("Failed to submit answer")
    }

    const result = await response.json()

    // Refresh data to update stats
    await fetchQuizData()

    return result
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <ArrowClockwise className="size-6" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchQuizData}
          className="mt-2"
        >
          <ArrowClockwise className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!quizData) {
    return null
  }

  const { questionOfTheDay, questions, stats } = quizData

  // Filter questions by level
  const filteredQuestions =
    levelFilter === "all"
      ? questions
      : questions.filter((q) => q.level === levelFilter)

  // Separate unanswered and answered questions
  const unansweredQuestions = filteredQuestions.filter((q) => !q.answered)
  const answeredQuestions = filteredQuestions.filter((q) => q.answered)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <GraduationCap className="size-5" weight="fill" />
            Learn & Earn
          </h2>
          <p className="text-muted-foreground text-sm">
            Answer fundraising questions correctly to earn bonus messages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQuizData}>
          <ArrowClockwise className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <QuizStats {...stats} />

      {/* Quiz Content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "daily" | "all")}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Star className="size-4" weight="fill" />
            Daily Question
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Sparkle className="size-4" />
            All Questions
          </TabsTrigger>
        </TabsList>

        {/* Daily Question Tab */}
        <TabsContent value="daily" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="size-5 text-yellow-500" weight="fill" />
              <span className="font-medium">Today&apos;s Question</span>
              {questionOfTheDay.answered && (
                <Badge variant="secondary">Completed</Badge>
              )}
            </div>
            <QuizQuestionCard
              {...questionOfTheDay}
              questionId={questionOfTheDay.id}
              onSubmit={handleSubmitAnswer}
            />
          </div>
        </TabsContent>

        {/* All Questions Tab */}
        <TabsContent value="all" className="mt-0">
          <div className="space-y-4">
            {/* Level Filter */}
            <div className="flex flex-wrap gap-2">
              {(["all", "basic", "intermediate", "advanced"] as const).map(
                (level) => (
                  <Button
                    key={level}
                    variant={levelFilter === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLevelFilter(level)}
                    className={cn(
                      level === "basic" &&
                        levelFilter === level &&
                        "bg-green-600 hover:bg-green-700",
                      level === "intermediate" &&
                        levelFilter === level &&
                        "bg-yellow-600 hover:bg-yellow-700",
                      level === "advanced" &&
                        levelFilter === level &&
                        "bg-red-600 hover:bg-red-700"
                    )}
                  >
                    {level === "all"
                      ? "All"
                      : level.charAt(0).toUpperCase() + level.slice(1)}
                    {level !== "all" && (
                      <span className="ml-1 opacity-70">
                        ({questions.filter((q) => q.level === level).length})
                      </span>
                    )}
                  </Button>
                )
              )}
            </div>

            {/* Unanswered Questions */}
            {unansweredQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-muted-foreground text-sm font-medium">
                  Available Questions ({unansweredQuestions.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {unansweredQuestions.map((question) => (
                    <QuizQuestionCard
                      key={question.id}
                      {...question}
                      questionId={question.id}
                      onSubmit={handleSubmitAnswer}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Answered Questions */}
            {answeredQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-muted-foreground text-sm font-medium">
                  Completed Questions ({answeredQuestions.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {answeredQuestions.map((question) => (
                    <QuizQuestionCard
                      key={question.id}
                      {...question}
                      questionId={question.id}
                      onSubmit={handleSubmitAnswer}
                      disabled
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All completed message */}
            {unansweredQuestions.length === 0 &&
              answeredQuestions.length === filteredQuestions.length && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                  <GraduationCap className="text-muted-foreground mb-4 size-12" />
                  <h3 className="font-semibold">All questions completed!</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    You&apos;ve answered all{" "}
                    {levelFilter === "all" ? "" : `${levelFilter} `}
                    questions. Check back next month for new challenges.
                  </p>
                </div>
              )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Info Banner */}
      <div className="rounded-lg border bg-gradient-to-r from-purple-500/5 to-blue-500/5 p-4">
        <h3 className="mb-2 font-medium">How Rewards Work</h3>
        <ul className="text-muted-foreground space-y-1 text-sm">
          <li>
            • <span className="text-green-600 dark:text-green-400">Basic</span>{" "}
            questions earn 5 bonus messages
          </li>
          <li>
            •{" "}
            <span className="text-yellow-600 dark:text-yellow-400">
              Intermediate
            </span>{" "}
            questions earn 7 bonus messages
          </li>
          <li>
            •{" "}
            <span className="text-red-600 dark:text-red-400">Advanced</span>{" "}
            questions earn 10 bonus messages
          </li>
          <li>• Maximum of 100 bonus messages per month</li>
          <li>• A new daily question rotates each day</li>
        </ul>
      </div>
    </div>
  )
}
