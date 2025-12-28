"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SpeakerHigh, SpeakerX, SpinnerGap } from "@phosphor-icons/react"
import { useCallback } from "react"
import { useTextToSpeech, type TTSState } from "@/app/hooks/use-text-to-speech"
import { useVoiceFeatures } from "@/app/hooks/use-voice-features"

interface TextToSpeechButtonProps {
  text: string
  className?: string
}

export function TextToSpeechButton({ text, className }: TextToSpeechButtonProps) {
  const { state, speak, stop, isSupported, errorMessage } = useTextToSpeech()
  const { textToSpeechEnabled, isLoading: isCheckingFeatures } = useVoiceFeatures()

  const handleClick = useCallback(async () => {
    if (state === "playing") {
      stop()
    } else if (state === "idle") {
      await speak(text)
    }
  }, [state, speak, stop, text])

  // Hide button if browser doesn't support or Groq API not configured
  if (!isSupported || isCheckingFeatures || !textToSpeechEnabled) {
    return null
  }

  const isLoading = state === "loading"
  const isPlaying = state === "playing"
  const isError = state === "error"

  const getTooltip = () => {
    if (isError && errorMessage) return errorMessage
    if (isLoading) return "Generating speech..."
    if (isPlaying) return "Stop playback"
    return "Listen"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition",
            isPlaying && "text-primary",
            isError && "text-destructive",
            className
          )}
          aria-label={isPlaying ? "Stop speech" : "Read aloud"}
          onClick={handleClick}
          type="button"
          disabled={isLoading}
        >
          {isLoading ? (
            <SpinnerGap className="size-4 animate-spin" />
          ) : isPlaying ? (
            <SpeakerX className="size-4" />
          ) : (
            <SpeakerHigh className="size-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{getTooltip()}</p>
      </TooltipContent>
    </Tooltip>
  )
}
