"use client"

import { Progress } from "@/components/ui/progress"
import { Sparkle, Trophy, Target, CheckCircle } from "@phosphor-icons/react"

interface QuizStatsProps {
  totalQuestions: number
  totalAnswered: number
  totalCorrect: number
  currentBonusBalance: number
  monthlyBonusEarned: number
  remainingMonthlyCapacity: number
  maxMonthlyBonus: number
}

export function QuizStats({
  totalQuestions,
  totalAnswered,
  totalCorrect,
  currentBonusBalance,
  monthlyBonusEarned,
  remainingMonthlyCapacity,
  maxMonthlyBonus,
}: QuizStatsProps) {
  const completionPercent = Math.round((totalAnswered / totalQuestions) * 100)
  const accuracyPercent =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
  const monthlyPercent = Math.round((monthlyBonusEarned / maxMonthlyBonus) * 100)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Current Bonus Balance */}
      <div className="rounded-lg border bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <Sparkle className="size-5" weight="fill" />
          <span className="text-sm font-medium">Bonus Balance</span>
        </div>
        <div className="mt-2 text-3xl font-bold">{currentBonusBalance}</div>
        <p className="text-muted-foreground mt-1 text-xs">
          Extra messages available
        </p>
      </div>

      {/* Monthly Progress */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
          <Target className="size-5" weight="fill" />
          <span className="text-sm font-medium">Monthly Rewards</span>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{monthlyBonusEarned}</span>
            <span className="text-muted-foreground text-sm">
              / {maxMonthlyBonus}
            </span>
          </div>
          <Progress value={monthlyPercent} className="mt-2" />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {remainingMonthlyCapacity} more available this month
        </p>
      </div>

      {/* Quiz Completion */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Trophy className="size-5" weight="fill" />
          <span className="text-sm font-medium">Quiz Progress</span>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{totalAnswered}</span>
            <span className="text-muted-foreground text-sm">
              / {totalQuestions}
            </span>
          </div>
          <Progress value={completionPercent} className="mt-2" />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {completionPercent}% complete
        </p>
      </div>

      {/* Accuracy */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle className="size-5" weight="fill" />
          <span className="text-sm font-medium">Accuracy</span>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{totalCorrect}</span>
            <span className="text-muted-foreground text-sm">correct</span>
          </div>
          <Progress
            value={accuracyPercent}
            className="mt-2 [&>div]:bg-green-500"
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {accuracyPercent}% accuracy rate
        </p>
      </div>
    </div>
  )
}
