"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SpinnerGap, Waveform } from "@phosphor-icons/react"
import { useCallback, useEffect, useState } from "react"
import { useVoiceRecording } from "@/app/hooks/use-voice-recording"
import { useVoiceFeatures } from "@/app/hooks/use-voice-features"

interface VoiceRecordButtonProps {
  onTranscription: (text: string) => void
  disabled?: boolean
  className?: string
}

export function VoiceRecordButton({
  onTranscription,
  disabled,
  className,
}: VoiceRecordButtonProps) {
  const [showError, setShowError] = useState(false)
  const { speechToTextEnabled, isLoading: isCheckingFeatures } = useVoiceFeatures()

  const handleTranscription = useCallback(
    (text: string) => {
      onTranscription(text)
    },
    [onTranscription]
  )

  const handleError = useCallback((error: string) => {
    console.error("Voice recording error:", error)
    setShowError(true)
    setTimeout(() => setShowError(false), 3000)
  }, [])

  const {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
    errorMessage,
  } = useVoiceRecording({
    onTranscription: handleTranscription,
    onError: handleError,
  })

  // Handle keyboard shortcut to cancel recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state === "recording") {
        cancelRecording()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state, cancelRecording])

  const handleClick = useCallback(async () => {
    if (state === "recording") {
      await stopRecording()
    } else if (state === "idle") {
      await startRecording()
    }
  }, [state, startRecording, stopRecording])

  // Hide button if browser doesn't support or Groq API not configured
  if (!isSupported || isCheckingFeatures || !speechToTextEnabled) {
    return null
  }

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isDisabled = disabled || isProcessing

  const getTooltip = () => {
    if (showError && errorMessage) return errorMessage
    if (isProcessing) return "Transcribing..."
    if (isRecording) return "Click to stop recording"
    return "Voice input"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          className={cn(
            "size-9 rounded-full transition-all duration-300 ease-out",
            isRecording && "bg-red-500 text-white hover:bg-red-600",
            isProcessing && "opacity-70",
            showError && "bg-destructive",
            className
          )}
          disabled={isDisabled}
          type="button"
          onClick={handleClick}
          aria-label={isRecording ? "Stop recording" : "Start voice recording"}
        >
          {isProcessing ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : isRecording ? (
            <RecordingIndicator />
          ) : (
            <Waveform className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{getTooltip()}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// Animated recording indicator with waveform bars
function RecordingIndicator() {
  return (
    <div className="flex items-center justify-center gap-0.5">
      <span className="bg-white w-0.5 h-2.5 rounded-full animate-[voice-bar_400ms_ease-in-out_0ms_infinite_alternate]" />
      <span className="bg-white w-0.5 h-3.5 rounded-full animate-[voice-bar_400ms_ease-in-out_100ms_infinite_alternate]" />
      <span className="bg-white w-0.5 h-2 rounded-full animate-[voice-bar_400ms_ease-in-out_200ms_infinite_alternate]" />
      <span className="bg-white w-0.5 h-3 rounded-full animate-[voice-bar_400ms_ease-in-out_300ms_infinite_alternate]" />
    </div>
  )
}
