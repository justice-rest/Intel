"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  XCircle,
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

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="flex items-center justify-center py-12">
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
          <div className="checkout__box compact">
            <h2>Daily Quiz Complete</h2>

            <div className="status-line">
              <span className="status_name">Bonus</span>
              <span className="status_value text-purple-600 dark:text-purple-400">{currentBonusBalance}/{maxBonusCredits}</span>
            </div>

            <hr />

            <div className="flex flex-col items-center py-4">
              <Trophy className="size-12 text-yellow-500 mb-2" weight="fill" />
              <p className="text-center text-xs text-muted-foreground">
                You&apos;ve already answered today&apos;s question.<br />
                Come back tomorrow for a new one!
              </p>
            </div>

            <div className="checkout__btns">
              <div className="cart_btn full-width">
                <button type="button" className="btn addtocart" onClick={onClose}>
                  Got it!
                </button>
              </div>
            </div>

            <style jsx>{styles}</style>
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
          <div className="checkout__box compact">
            <h2>{result.correct ? "Correct!" : "Incorrect"}</h2>

            <div className="status-line">
              <span className="status_name">Result</span>
              <span className={`status_value ${result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {result.bonusChange > 0 ? "+" : ""}{result.bonusChange} bonus
              </span>
            </div>

            <div className="status-line">
              <span className="status_name">Balance</span>
              <span className="status_value text-purple-600 dark:text-purple-400">{result.newBonusBalance}/{maxBonusCredits}</span>
            </div>

            <hr />

            {!result.correct && (
              <div className="correct-answer-box">
                <span className="correct-label">Correct answer:</span> {correctOption?.label}
              </div>
            )}

            <div className="explanation-box">
              <div className="explanation-title">
                <GraduationCap size={14} weight="fill" className="inline-block mr-1" />
                Why?
              </div>
              <p className="explanation-text">{result.explanation}</p>
            </div>

            <div className="checkout__btns">
              <div className="cart_btn full-width">
                <button type="button" className="btn addtocart" onClick={onClose}>
                  Continue
                </button>
              </div>
            </div>

            <style jsx>{styles}</style>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Show question
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="checkout__box compact">
          <h2>Daily Quiz</h2>

          <div className="status-line">
            <span className="status_name">Bonus</span>
            <span className="status_value text-purple-600 dark:text-purple-400">{currentBonusBalance}/{maxBonusCredits}</span>
          </div>

          <hr />

          {question && (
            <>
              <div className="question-text">{question.question}</div>

              <div className="checkout__opts">
                {question.options.map((option, index) => (
                  <div
                    key={option.value}
                    className={`opt opt${index + 1} ${selectedAnswer === option.value ? "selected" : ""}`}
                    onClick={() => handleOptionClick(option.value)}
                  >
                    <div className="gridme">
                      <div className="radio">
                        <span className="radio_btn"></span>
                      </div>
                      <div className="lbl">{option.value}. {option.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="checkout__btns">
                <div className="cart_btn full-width">
                  <button
                    type="button"
                    className="btn addtocart"
                    onClick={handleSubmit}
                    disabled={!selectedAnswer || isSubmitting}
                  >
                    {isSubmitting ? "Checking..." : "Submit Answer"}
                  </button>
                </div>
                <div className="cart_btn full-width" style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn manage-billing"
                    onClick={onClose}
                  >
                    Skip
                  </button>
                </div>
              </div>

              <div className="guarantee">
                <div>
                  <Gift size={20} weight="regular" className="mx-auto mb-1" />
                  +{question.bonusMessages} correct
                </div>
                <div className="line"></div>
                <div>
                  <XCircle size={20} weight="regular" className="mx-auto mb-1" />
                  -{question.penalty} wrong
                </div>
              </div>
            </>
          )}

          <style jsx>{styles}</style>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const styles = `
  .checkout__box {
    padding: 16px;
    background: #fff;
    margin: 0 auto;
    border: 1px solid #ddd;
    max-width: 600px;
    width: 100%;
  }

  .checkout__box.compact {
    padding: 14px;
  }

  :global(.dark) .checkout__box {
    background: #1a1a1a;
    border: 1px solid #333;
  }

  .checkout__box h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    color: black;
  }

  :global(.dark) .checkout__box h2 {
    color: white;
  }

  .status-line {
    text-align: right;
    font-size: 14px;
    font-weight: 700;
    color: black;
    margin-bottom: 6px;
    position: relative;
  }

  :global(.dark) .status-line {
    color: white;
  }

  .status_name {
    position: absolute;
    left: 0;
    font-weight: 400;
    color: #666;
  }

  :global(.dark) .status_name {
    color: #999;
  }

  .status_value {
    font-size: 14px;
    font-weight: 600;
  }

  .question-text {
    font-size: 14px;
    font-weight: 500;
    color: black;
    margin-bottom: 12px;
    line-height: 1.4;
  }

  :global(.dark) .question-text {
    color: white;
  }

  .correct-answer-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 5px;
    padding: 10px;
    margin-bottom: 10px;
    font-size: 13px;
    color: #991b1b;
  }

  :global(.dark) .correct-answer-box {
    background: #2a1515;
    border-color: #7f1d1d;
    color: #fca5a5;
  }

  .correct-label {
    font-weight: 600;
  }

  .explanation-box {
    background: #f9f9f9;
    border: 1px solid #eee;
    border-radius: 5px;
    padding: 10px;
    margin-bottom: 12px;
  }

  :global(.dark) .explanation-box {
    background: #222;
    border-color: #333;
  }

  .explanation-title {
    font-size: 13px;
    font-weight: 600;
    color: black;
    margin-bottom: 6px;
  }

  :global(.dark) .explanation-title {
    color: white;
  }

  .explanation-text {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }

  :global(.dark) .explanation-text {
    color: #999;
  }

  hr {
    border: none;
    margin: 8px 0;
    padding: 0;
    border-bottom: 1px solid #ddd;
  }

  :global(.dark) hr {
    border-bottom-color: #333;
  }

  .checkout__opts .opt {
    padding: 10px 0;
    border: 1px solid #ccc;
    border-radius: 5px;
    margin-bottom: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  :global(.dark) .checkout__opts .opt {
    border-color: #444;
  }

  .checkout__opts .opt.selected {
    border: 2px solid black;
  }

  :global(.dark) .checkout__opts .opt.selected {
    border: 2px solid #3ab54b;
  }

  .checkout__opts .opt.selected .radio_btn {
    border: 2px solid #3ab54b;
  }

  .checkout__opts .opt.selected .radio_btn::before {
    content: "";
    width: 8px;
    height: 8px;
    display: block;
    position: absolute;
    background: #3ab54b;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .gridme {
    display: grid;
    grid-template-columns: 28px 1fr;
    align-items: center;
    padding: 0 12px;
    color: black;
  }

  :global(.dark) .gridme {
    color: white;
  }

  .lbl {
    font-size: 13px;
    line-height: 1.3;
  }

  .radio_btn {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid #bbb;
    display: block;
    position: relative;
  }

  :global(.dark) .radio_btn {
    border-color: #666;
  }

  .checkout__btns {
    display: block;
    margin-bottom: 12px;
  }

  .full-width {
    width: 100%;
  }

  .btn.addtocart,
  .btn.manage-billing {
    display: block;
    border-radius: 4px;
    color: black;
    font-size: 14px;
    font-weight: 600;
    width: 100%;
    border: 1px solid rgb(255, 187, 16);
    background-color: rgb(255, 187, 16);
    height: 44px;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .btn.addtocart:hover:not(:disabled),
  .btn.manage-billing:hover {
    background-color: transparent;
    border-color: rgb(255, 187, 16);
    color: black;
  }

  :global(.dark) .btn.addtocart:hover:not(:disabled),
  :global(.dark) .btn.manage-billing:hover {
    color: white;
  }

  .btn.addtocart:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.manage-billing {
    background-color: transparent;
    border-color: #ccc;
    height: 36px;
    font-size: 13px;
  }

  :global(.dark) .btn.manage-billing {
    border-color: #444;
    color: white;
  }

  .guarantee {
    display: grid;
    grid-template-columns: 1fr 2px 1fr;
    grid-column-gap: 5px;
    text-align: center;
    padding: 6px 0;
    border-top: 1px solid #ddd;
  }

  :global(.dark) .guarantee {
    border-top-color: #333;
  }

  .guarantee div {
    padding: 6px;
    font-size: 11px;
    color: #666;
  }

  :global(.dark) .guarantee div {
    color: #999;
  }

  .guarantee div.line {
    padding: 0;
    border-right: 1px solid #ddd;
  }

  :global(.dark) .guarantee div.line {
    border-right-color: #333;
  }

  .guarantee svg {
    color: #666;
  }

  :global(.dark) .guarantee svg {
    color: #999;
  }
`
