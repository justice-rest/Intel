"use client"

import { useCallback, useRef, useState } from "react"

export type TTSState = "idle" | "loading" | "playing" | "error"

type OrpheusVoice = "autumn" | "diana" | "hannah" | "austin" | "daniel" | "troy"

interface UseTextToSpeechOptions {
  voice?: OrpheusVoice
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface UseTextToSpeechReturn {
  state: TTSState
  speak: (text: string) => Promise<void>
  stop: () => void
  isSupported: boolean
  errorMessage: string | null
}

export function useTextToSpeech({
  voice = "hannah",
  onStart,
  onEnd,
  onError,
}: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
  const [state, setState] = useState<TTSState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Check if Audio API is supported
  const isSupported = typeof window !== "undefined" && typeof Audio !== "undefined"

  const stop = useCallback(() => {
    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Stop and cleanup audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.src = ""
      audioRef.current = null
    }

    setState("idle")
    setErrorMessage(null)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      if (!isSupported) {
        setErrorMessage("Text-to-speech is not supported in this browser")
        onError?.("Text-to-speech is not supported in this browser")
        return
      }

      if (!text || text.trim().length === 0) {
        return
      }

      // Stop any existing playback
      stop()

      try {
        setState("loading")
        setErrorMessage(null)

        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        const response = await fetch("/api/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            voice,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error || "Text-to-speech synthesis failed")
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          setState("playing")
          onStart?.()
        }

        audio.onended = () => {
          setState("idle")
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
          onEnd?.()
        }

        audio.onerror = () => {
          setState("error")
          setErrorMessage("Failed to play audio")
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
          onError?.("Failed to play audio")
        }

        await audio.play()
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted, ignore
          setState("idle")
          return
        }

        console.error("TTS error:", error)
        const message = error instanceof Error ? error.message : "Text-to-speech failed"
        setErrorMessage(message)
        setState("error")
        onError?.(message)
      }
    },
    [isSupported, voice, stop, onStart, onEnd, onError]
  )

  return {
    state,
    speak,
    stop,
    isSupported,
    errorMessage,
  }
}
