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

// Waveform animation component - consistent sizing
function PlayingWaveform({
  amplitudeLevels,
}: {
  amplitudeLevels: number[]
}) {
  return (
    <div className="w-5 h-5 relative flex items-center justify-center">
      <div className="flex items-center gap-[2px]">
        {amplitudeLevels.map((level, idx) => {
          const height = Math.min(Math.max(level * 30, 0.3), 1) * 16
          return (
            <div
              key={idx}
              className="w-[2px] bg-white rounded-full animate-wave"
              style={{
                height: `${height}px`,
                animationDelay: `${idx * 0.1}s`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// Play Icon SVG - consistent 20x20 size
function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.5 3.5C4.5 3.18 4.68 2.89 4.96 2.76C5.24 2.63 5.57 2.67 5.81 2.86L16.19 9.36C16.38 9.52 16.5 9.75 16.5 10C16.5 10.25 16.38 10.48 16.19 10.64L5.81 17.14C5.57 17.33 5.24 17.37 4.96 17.24C4.68 17.11 4.5 16.82 4.5 16.5V3.5Z"
      />
    </svg>
  )
}

// Audio clip hook - exactly like openai-fm
const CLIPS: Record<string, HTMLAudioElement> = {}

function useAudioClip(path: string) {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (CLIPS[path]) return

    const audio = new Audio(path)
    audio.preload = "auto"

    if (window.requestIdleCallback) {
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
    audio.play().catch(() => {})
  }, [path])
}

export function ResearchPlayButton({
  onClick,
  isProcessing,
  isPaused = false,
  disabled = false,
  className,
}: ResearchPlayButtonProps) {
  const [amplitudeLevels, setAmplitudeLevels] = useState<number[]>([0.032, 0.032, 0.032, 0.032, 0.032])
  const amplitudeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playPressed = useAudioClip("/pressed.wav")

  // Generate random amplitudes for animation - like openai-fm
  const generateRandomAmplitudes = useCallback(
    () => Array(5).fill(0).map(() => Math.random() * 0.06),
    []
  )

  // Start/stop animation when processing state changes
  useEffect(() => {
    if (isProcessing && !isPaused) {
      amplitudeIntervalRef.current = setInterval(() => {
        setAmplitudeLevels(generateRandomAmplitudes())
      }, 100)
    } else {
      if (amplitudeIntervalRef.current) {
        clearInterval(amplitudeIntervalRef.current)
        amplitudeIntervalRef.current = null
      }
      setAmplitudeLevels([0.032, 0.032, 0.032, 0.032, 0.032])
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

  const isActive = isProcessing && !isPaused
  const buttonText = isProcessing
    ? isPaused
      ? "Resume"
      : "Stop"
    : "Play"

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (["Enter", " "].includes(e.key)) {
          handleClick()
        }
      }}
      className={cn(
        // Base styles - compact button
        "flex items-center justify-center gap-2 flex-1 rounded-md py-2.5 px-4",
        "cursor-pointer select-none transition-all duration-200",
        // Primary color - openai-fm orange #ff4a00
        "text-white bg-[#ff4a00]",
        // Border - white in light mode, dark in dark mode
        "ring-1 ring-white/30 dark:ring-black/30",
        // Hover effect
        "hover:brightness-110 active:brightness-95",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {isActive ? (
        <PlayingWaveform amplitudeLevels={amplitudeLevels} />
      ) : (
        <PlayIcon />
      )}
      <span className="uppercase hidden md:inline font-medium text-sm">
        {buttonText}
      </span>
    </div>
  )
}

// Stop/Cancel Button - consistent sizing
export function ResearchStopButton({
  onClick,
  disabled = false,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  const playPressed = useAudioClip("/pressed.wav")

  const handleClick = () => {
    if (disabled) return
    playPressed()
    onClick()
  }

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (["Enter", " "].includes(e.key)) {
          handleClick()
        }
      }}
      className={cn(
        // Base styles - compact button (matching play button)
        "flex items-center justify-center gap-2 flex-1 rounded-md py-2.5 px-4",
        "cursor-pointer select-none transition-all duration-200",
        // Secondary color - dark gray
        "text-white bg-[#222] dark:bg-[#333]",
        // Border - white in light mode, dark in dark mode
        "ring-1 ring-white/20 dark:ring-black/30",
        // Hover effect
        "hover:brightness-110 active:brightness-95",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Stop Icon - 20x20 matching play icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="4" width="12" height="12" rx="2" />
      </svg>
      <span className="uppercase hidden md:inline font-medium text-sm">
        Cancel
      </span>
    </div>
  )
}
