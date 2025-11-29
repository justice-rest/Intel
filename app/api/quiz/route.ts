import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  getQuestionOfTheDay,
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

// Penalty for wrong answers (negative bonus)
const WRONG_ANSWER_PENALTY = 3

// Maximum bonus credits a user can have (rollover allowed, but capped)
const MAX_BONUS_CREDITS = 100

/**
 * GET /api/quiz
 *
 * Returns quiz data including:
 * - Question of the day (only one question per day)
 * - Whether user has already answered today's question
 * - Current bonus balance (rolls over, capped at 100)
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

    // Get question of the day
    const questionOfTheDay = getQuestionOfTheDay()

    // Fetch user's progress for today's question and bonus balance in parallel
    const [progressResult, userResult] = await Promise.all([
      supabase
        .from("user_quiz_progress" as any)
        .select("question_id, answered_correctly, bonus_messages_earned, answered_at")
        .eq("user_id", user.id)
        .eq("question_id", questionOfTheDay.id)
        .maybeSingle() as any,
      supabase
        .from("users")
        .select("bonus_messages")
        .eq("id", user.id)
        .single(),
    ])

    const todayProgress: QuizProgress | null = progressResult.data || null
    const currentBonusBalance: number = userResult.error ? 0 : ((userResult.data as any)?.bonus_messages || 0)

    return NextResponse.json({
      questionOfTheDay: {
        id: questionOfTheDay.id,
        level: questionOfTheDay.level,
        category: questionOfTheDay.category,
        question: questionOfTheDay.question,
        options: questionOfTheDay.options,
        bonusMessages: questionOfTheDay.bonusMessages,
        penalty: WRONG_ANSWER_PENALTY,
        answered: !!todayProgress,
        answeredCorrectly: todayProgress?.answered_correctly ?? null,
        earnedBonus: todayProgress?.bonus_messages_earned ?? 0,
      },
      currentBonusBalance,
      maxBonusCredits: MAX_BONUS_CREDITS,
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
 * - Correct answer: +bonusMessages points
 * - Wrong answer: -3 points (penalty)
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

    // Get current user bonus balance
    const { data: currentUser } = await supabase
      .from("users")
      .select("bonus_messages" as any)
      .eq("id", user.id)
      .single()

    const currentBonus = (currentUser as any)?.bonus_messages || 0

    // Calculate bonus: positive for correct (capped at 100), negative (penalty) for wrong
    let bonusChange = isCorrect ? question.bonusMessages : -WRONG_ANSWER_PENALTY

    // Cap bonus at MAX_BONUS_CREDITS (100)
    if (isCorrect && currentBonus + bonusChange > MAX_BONUS_CREDITS) {
      bonusChange = MAX_BONUS_CREDITS - currentBonus
      if (bonusChange < 0) bonusChange = 0 // Already at max
    }

    // Don't let bonus go below 0
    const newBonus = Math.max(0, Math.min(MAX_BONUS_CREDITS, currentBonus + bonusChange))

    // Record the answer
    const { error: insertError } = await (supabase
      .from("user_quiz_progress" as any)
      .insert({
        user_id: user.id,
        question_id: questionId,
        answered_correctly: isCorrect,
        bonus_messages_earned: bonusChange, // Can be negative for penalties
      }) as any)

    if (insertError) {
      console.error("[Quiz API] Error recording answer:", insertError)
      return NextResponse.json(
        { error: "Failed to record answer" },
        { status: 500 }
      )
    }

    // Update user's bonus_messages balance
    await supabase
      .from("users")
      .update({ bonus_messages: newBonus } as any)
      .eq("id", user.id)

    return NextResponse.json({
      correct: isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      bonusChange, // Positive or negative
      newBonusBalance: newBonus,
    })
  } catch (error) {
    console.error("[Quiz API] Error submitting answer:", error)
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    )
  }
}
