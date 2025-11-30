"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface ResearchPlayButtonProps {
  onClick: () => void
  isProcessing: boolean
  isPaused?: boolean
  disabled?: boolean
  className?: string
}

// Waveform animation component
function PlayingWaveform({
  audioLoaded,
  amplitudeLevels,
}: {
  audioLoaded: boolean
  amplitudeLevels: number[]
}) {
  return (
    <div className="w-[36px] h-[16px] relative left-[4px] flex items-center justify-center gap-[4px]">
      {amplitudeLevels.map((level, idx) => {
        const height = `${Math.min(Math.max(level * 30, 0.2), 1.9) * 100}%`
        return (
          <div
            key={idx}
            className={cn(
              "w-[3px] bg-white transition-all duration-150 rounded-[2px]",
              !audioLoaded && "animate-wave"
            )}
            style={{
              height: audioLoaded ? height : "30%",
              animationDelay: `${idx * 0.15}s`,
            }}
          />
        )
      })}
    </div>
  )
}

// Play Icon SVG
function PlayIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 36 36"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.85905 6.08889C8.62661 5.96437 8.34585 5.97106 8.11961 6.10652C7.89336 6.24198 7.75488 6.48631 7.75488 6.75V29.25C7.75488 29.5137 7.89336 29.758 8.11961 29.8935C8.34585 30.0289 8.62661 30.0356 8.85905 29.9111L29.8592 18.6611C30.1029 18.5305 30.255 18.2765 30.255 18C30.255 17.7235 30.1029 17.4695 29.8592 17.3389L8.85905 6.08889Z"
      />
    </svg>
  )
}

// Audio clip hook (from openai-fm)
const CLIPS: Record<string, HTMLAudioElement> = {}

function useAudioClip(path: string) {
  useEffect(() => {
    if (CLIPS[path]) {
      return
    }

    const audio = new Audio(path)
    audio.preload = "auto"

    if (typeof window !== "undefined" && window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        audio.load()
      })
    } else {
      audio.load()
    }
    CLIPS[path] = audio
  }, [path])

  return useCallback(() => {
    const audio = CLIPS[path]
    if (!audio) return

    audio.volume = 0.2
    audio.currentTime = 0
    audio.play().catch(() => {
      // Ignore errors (e.g., user hasn't interacted with page yet)
    })
  }, [path])
}

export function ResearchPlayButton({
  onClick,
  isProcessing,
  isPaused = false,
  disabled = false,
  className,
}: ResearchPlayButtonProps) {
  const [amplitudeLevels, setAmplitudeLevels] = useState<number[]>(
    new Array(5).fill(0.032)
  )
  const amplitudeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playPressed = useAudioClip("/pressed.wav")

  // Generate random amplitudes for animation
  const generateRandomAmplitudes = useCallback(
    () => Array(5).fill(0).map(() => Math.random() * 0.06 + 0.02),
    []
  )

  // Start/stop animation when processing state changes
  useEffect(() => {
    if (isProcessing && !isPaused) {
      // Start animation
      amplitudeIntervalRef.current = setInterval(() => {
        setAmplitudeLevels(generateRandomAmplitudes())
      }, 100)
    } else {
      // Stop animation
      if (amplitudeIntervalRef.current) {
        clearInterval(amplitudeIntervalRef.current)
        amplitudeIntervalRef.current = null
      }
      setAmplitudeLevels(new Array(5).fill(0.032))
    }

    return () => {
      if (amplitudeIntervalRef.current) {
        clearInterval(amplitudeIntervalRef.current)
      }
    }
  }, [isProcessing, isPaused, generateRandomAmplitudes])

  const handleClick = () => {
    if (disabled) return
    if (!isProcessing) {
      playPressed()
    }
    onClick()
  }

  const buttonText = isProcessing
    ? isPaused
      ? "Resume"
      : "Running"
    : "Start Research"

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        // Base styles
        "relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl",
        "font-semibold text-white uppercase tracking-wide text-sm",
        "transition-all duration-300 cursor-pointer select-none",
        // Primary color (cyan/teal from openai-fm)
        "bg-[#00A5E4]",
        // Shadow and depth effect
        "shadow-[inset_1px_1px_1px_rgba(255,255,255,0.83),inset_-1px_-1px_1px_rgba(0,0,0,0.23),0.4px_0.4px_0.6px_-1px_rgba(0,0,0,0.26),1.2px_1.2px_1.7px_-1.5px_rgba(0,0,0,0.25),2.7px_2.7px_3.8px_-2.25px_rgba(0,0,0,0.23),5.9px_5.9px_8.3px_-3px_rgba(0,0,0,0.19),10px_10px_21px_-3.75px_rgba(0,0,0,0.23),-0.5px_-0.5px_0_0_rgba(149,43,0,0.53)]",
        // Active/Selected state
        isProcessing && !isPaused && [
          "shadow-[inset_0.5px_0.5px_1px_rgba(255,255,255,1),inset_-0.5px_-0.5px_1px_rgba(0,0,0,0.36),0.2px_0.2px_0.3px_-1px_rgba(0,0,0,0.2),0.6px_0.6px_0.9px_-1px_rgba(0,0,0,0.18),1.3px_1.3px_1.9px_-1.5px_rgba(0,0,0,0.25),3px_3px_4.2px_-2px_rgba(0,0,0,0.1),2.5px_2.5px_3px_-2.5px_rgba(0,0,0,0.15),-0.5px_-0.5px_0_0_rgba(0,0,0,0.13)]",
        ],
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        // Hover effect when not processing
        !isProcessing && !disabled && "hover:brightness-110 active:brightness-95",
        className
      )}
    >
      {isProcessing && !isPaused ? (
        <PlayingWaveform
          audioLoaded={true}
          amplitudeLevels={amplitudeLevels}
        />
      ) : (
        <PlayIcon />
      )}
      <span className="pr-1">{buttonText}</span>
    </button>
  )
}
