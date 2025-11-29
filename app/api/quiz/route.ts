import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  QUIZ_QUESTIONS,
  getQuestionOfTheDay,
  MAX_MONTHLY_BONUS,
  getQuestionById,
} from "@/lib/quiz/questions"

export const runtime = "nodejs"

// Type definitions for quiz tables (until Supabase types are regenerated)
interface QuizProgress {
  id: string
  user_id: string
  question_id: string
  answered_correctly: boolean
  bonus_messages_earned: number
  answered_at: string
}

interface MonthlyLimit {
  id: string
  user_id: string
  month_year: string
  total_bonus_earned: number
}

/**
 * GET /api/quiz
 *
 * Returns quiz data including:
 * - Question of the day
 * - All available questions
 * - User's progress (which questions they've answered)
 * - Current month's bonus balance and remaining capacity
 */
export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 })
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current month for tracking
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Fetch user's quiz progress and monthly limit in parallel
    // Using type assertions since these tables may not be in generated types yet
    const [progressResult, monthlyResult, userResult] = await Promise.all([
      supabase
        .from("user_quiz_progress" as any)
        .select("question_id, answered_correctly, bonus_messages_earned, answered_at")
        .eq("user_id", user.id) as any,
      supabase
        .from("user_quiz_monthly_limits" as any)
        .select("total_bonus_earned")
        .eq("user_id", user.id)
        .eq("month_year", monthYear)
        .maybeSingle() as any,
      supabase
        .from("users")
        .select("bonus_messages")
        .eq("id", user.id)
        .single(),
    ])

    // Handle errors gracefully - these tables may not exist yet
    const progress: QuizProgress[] = progressResult.error ? [] : (progressResult.data || [])
    const monthlyBonusEarned: number = monthlyResult.error ? 0 : (monthlyResult.data?.total_bonus_earned || 0)
    // Handle case where bonus_messages column doesn't exist yet
    const currentBonusBalance: number = userResult.error ? 0 : ((userResult.data as any)?.bonus_messages || 0)

    // Build a map of answered questions
    const answeredQuestions = new Map(
      progress.map((p) => [p.question_id, p])
    )

    // Get question of the day
    const questionOfTheDay = getQuestionOfTheDay()

    // Build questions list with completion status (without revealing answers)
    const questionsWithStatus = QUIZ_QUESTIONS.map((q) => {
      const answered = answeredQuestions.get(q.id)
      return {
        id: q.id,
        level: q.level,
        category: q.category,
        question: q.question,
        options: q.options,
        bonusMessages: q.bonusMessages,
        // Only include answer-related info if already answered
        answered: !!answered,
        answeredCorrectly: answered?.answered_correctly ?? null,
        earnedBonus: answered?.bonus_messages_earned ?? 0,
      }
    })

    // Calculate stats
    const totalQuestionsAnswered = progress.length
    const totalCorrect = progress.filter((p) => p.answered_correctly).length
    const totalBonusEarned = progress.reduce(
      (sum, p) => sum + (p.bonus_messages_earned || 0),
      0
    )
    const remainingMonthlyCapacity = Math.max(0, MAX_MONTHLY_BONUS - monthlyBonusEarned)

    return NextResponse.json({
      questionOfTheDay: {
        id: questionOfTheDay.id,
        level: questionOfTheDay.level,
        category: questionOfTheDay.category,
        question: questionOfTheDay.question,
        options: questionOfTheDay.options,
        bonusMessages: questionOfTheDay.bonusMessages,
        answered: answeredQuestions.has(questionOfTheDay.id),
      },
      questions: questionsWithStatus,
      stats: {
        totalQuestions: QUIZ_QUESTIONS.length,
        totalAnswered: totalQuestionsAnswered,
        totalCorrect,
        totalBonusEarned,
        currentBonusBalance,
        monthlyBonusEarned,
        remainingMonthlyCapacity,
        maxMonthlyBonus: MAX_MONTHLY_BONUS,
      },
    })
  } catch (error) {
    console.error("[Quiz API] Error fetching quiz data:", error)
    return NextResponse.json(
      { error: "Failed to fetch quiz data" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/quiz
 *
 * Submit an answer to a quiz question
 *
 * Body: { questionId: string, answer: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 })
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { questionId, answer } = body

    if (!questionId || !answer) {
      return NextResponse.json(
        { error: "Missing questionId or answer" },
        { status: 400 }
      )
    }

    // Get the question
    const question = getQuestionById(questionId)
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    // Check if already answered
    const { data: existing } = await (supabase
      .from("user_quiz_progress" as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle() as any)

    if (existing) {
      return NextResponse.json(
        { error: "Question already answered" },
        { status: 400 }
      )
    }

    // Check answer
    const isCorrect = answer === question.correctAnswer

    // Get current month
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Get current monthly bonus
    const { data: monthlyData } = await (supabase
      .from("user_quiz_monthly_limits" as any)
      .select("total_bonus_earned")
      .eq("user_id", user.id)
      .eq("month_year", monthYear)
      .maybeSingle() as any)

    const currentMonthlyBonus = monthlyData?.total_bonus_earned || 0

    // Calculate bonus (only if correct and under monthly cap)
    let bonusEarned = 0
    if (isCorrect) {
      const remainingCapacity = MAX_MONTHLY_BONUS - currentMonthlyBonus
      bonusEarned = Math.min(question.bonusMessages, remainingCapacity)
    }

    // Record the answer
    const { error: insertError } = await (supabase
      .from("user_quiz_progress" as any)
      .insert({
        user_id: user.id,
        question_id: questionId,
        answered_correctly: isCorrect,
        bonus_messages_earned: bonusEarned,
      }) as any)

    if (insertError) {
      console.error("[Quiz API] Error recording answer:", insertError)
      return NextResponse.json(
        { error: "Failed to record answer" },
        { status: 500 }
      )
    }

    // Update monthly limit tracking
    if (bonusEarned > 0) {
      const { error: upsertError } = await (supabase
        .from("user_quiz_monthly_limits" as any)
        .upsert(
          {
            user_id: user.id,
            month_year: monthYear,
            total_bonus_earned: currentMonthlyBonus + bonusEarned,
          },
          {
            onConflict: "user_id,month_year",
          }
        ) as any)

      if (upsertError) {
        console.error("[Quiz API] Error updating monthly limit:", upsertError)
      }

      // Update user's bonus_messages balance
      // First get current balance
      const { data: currentUser } = await supabase
        .from("users")
        .select("bonus_messages" as any)
        .eq("id", user.id)
        .single()

      const currentBonus = (currentUser as any)?.bonus_messages || 0

      // Then update with new total
      await supabase
        .from("users")
        .update({ bonus_messages: currentBonus + bonusEarned } as any)
        .eq("id", user.id)
    }

    return NextResponse.json({
      correct: isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      bonusEarned,
      monthlyBonusRemaining: MAX_MONTHLY_BONUS - (currentMonthlyBonus + bonusEarned),
    })
  } catch (error) {
    console.error("[Quiz API] Error submitting answer:", error)
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    )
  }
}
