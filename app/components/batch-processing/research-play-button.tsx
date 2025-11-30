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

// Waveform animation component - exactly like openai-fm
function PlayingWaveform({
  amplitudeLevels,
}: {
  amplitudeLevels: number[]
}) {
  return (
    <div className="w-[36px] h-[16px] relative left-[4px]">
      {amplitudeLevels.map((level, idx) => {
        const height = `${Math.min(Math.max(level * 30, 0.2), 1.9) * 100}%`
        return (
          <div
            key={idx}
            className="w-[2px] bg-white transition-all duration-150 rounded-[2px] absolute top-1/2 -translate-y-1/2 animate-wave"
            style={{
              height,
              animationDelay: `${idx * 0.15}s`,
              left: `${idx * 6}px`,
            }}
          />
        )
      })}
    </div>
  )
}

// Play Icon SVG - exactly like openai-fm
function PlayIcon() {
  return (
    <svg
      width="36"
      height="36"
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
        // Base styles - exactly like openai-fm Button
        "flex items-center justify-center gap-2 flex-1 rounded-md p-3",
        "cursor-pointer select-none transition-shadow duration-300",
        // Primary color - openai-fm orange #ff4a00
        "text-white bg-[#ff4a00]",
        // Default shadow - exactly like openai-fm primary button
        !isActive && [
          "shadow-[inset_1px_1px_1px_rgba(255,255,255,0.83),inset_-1px_-1px_1px_rgba(0,0,0,0.23),0.444584px_0.444584px_0.628737px_-1px_rgba(0,0,0,0.26),1.21072px_1.21072px_1.71222px_-1.5px_rgba(0,0,0,0.25),2.6583px_2.6583px_3.75941px_-2.25px_rgba(0,0,0,0.23),5.90083px_5.90083px_8.34503px_-3px_rgba(0,0,0,0.19),10px_10px_21.2132px_-3.75px_rgba(0,0,0,0.23),-0.5px_-0.5px_0_0_rgba(149,43,0,0.53)]",
        ],
        // Active/Selected state shadow - exactly like openai-fm
        isActive && [
          "shadow-[inset_0.5px_0.5px_1px_rgba(255,255,255,1),inset_-0.5px_-0.5px_1px_rgba(0,0,0,0.36),0.222px_0.222px_0.314px_-1px_rgba(0,0,0,0.2),0.605px_0.605px_0.856px_-1px_rgba(0,0,0,0.18),1.329px_1.329px_1.88px_-1.5px_rgba(0,0,0,0.25),2.95px_2.95px_4.172px_-2px_rgba(0,0,0,0.1),2.5px_2.5px_3px_-2.5px_rgba(0,0,0,0.15),-0.5px_-0.5px_0_0_rgba(0,0,0,0.13)]",
        ],
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
      <span className="uppercase hidden md:inline pr-3 font-medium text-[1.125rem]">
        {buttonText}
      </span>
    </div>
  )
}

// Stop/Cancel Button - openai-fm style secondary button
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
        // Base styles - openai-fm Button
        "flex items-center justify-center gap-2 flex-1 rounded-md p-3",
        "cursor-pointer select-none transition-shadow duration-300",
        // Secondary color - openai-fm dark gray #222
        "text-white bg-[#222]",
        // Shadow - openai-fm secondary button
        "shadow-[inset_1px_1px_1px_rgba(255,255,255,0.7),inset_-1px_-1px_1px_rgba(0,0,0,0.23),0.444584px_0.444584px_0.628737px_-0.75px_rgba(0,0,0,0.26),1.21072px_1.21072px_1.71222px_-1.5px_rgba(0,0,0,0.25),2.6583px_2.6583px_3.75941px_-2.25px_rgba(0,0,0,0.23),5.90083px_5.90083px_8.34503px_-3px_rgba(0,0,0,0.19),14px_14px_21.2132px_-3.75px_rgba(0,0,0,0.2),-0.5px_-0.5px_0_0_rgba(0,0,0,0.69)]",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Stop Icon */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="8" y="8" width="20" height="20" rx="2" />
      </svg>
      <span className="uppercase hidden md:inline pr-3 font-medium text-[1.125rem]">
        Cancel
      </span>
    </div>
  )
}
