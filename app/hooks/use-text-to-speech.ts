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

// Simple hash function for cache keys
function hashText(text: string, voice: string): string {
  let hash = 0
  const str = text + voice
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

// Client-side audio cache (persists across component renders)
// Map: cacheKey -> { blob: Blob, url: string, timestamp: number }
const audioCache = new Map<string, { blob: Blob; url: string; timestamp: number }>()
const CACHE_MAX_SIZE = 20 // Max cached audio files
const CACHE_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

function getCachedAudio(key: string): { blob: Blob; url: string } | null {
  const cached = audioCache.get(key)
  if (!cached) return null

  // Check if cache entry is still valid
  if (Date.now() - cached.timestamp > CACHE_MAX_AGE_MS) {
    URL.revokeObjectURL(cached.url)
    audioCache.delete(key)
    return null
  }

  return { blob: cached.blob, url: cached.url }
}

function setCachedAudio(key: string, blob: Blob): string {
  // Evict old entries if cache is full
  if (audioCache.size >= CACHE_MAX_SIZE) {
    // Find oldest entry
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [k, v] of audioCache.entries()) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp
        oldestKey = k
      }
    }

    if (oldestKey) {
      const old = audioCache.get(oldestKey)
      if (old) URL.revokeObjectURL(old.url)
      audioCache.delete(oldestKey)
    }
  }

  const url = URL.createObjectURL(blob)
  audioCache.set(key, { blob, url, timestamp: Date.now() })
  return url
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
  const currentUrlRef = useRef<string | null>(null)

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
      audioRef.current = null
    }

    // Note: We don't revoke cached URLs here
    currentUrlRef.current = null
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

      const cacheKey = hashText(text, voice)

      try {
        setState("loading")
        setErrorMessage(null)

        let audioUrl: string

        // Check cache first
        const cached = getCachedAudio(cacheKey)
        if (cached) {
          console.log("TTS: Using cached audio")
          audioUrl = cached.url
        } else {
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

          // Validate blob
          if (audioBlob.size < 100) {
            throw new Error("Received empty audio response")
          }

          // Cache the audio
          audioUrl = setCachedAudio(cacheKey, audioBlob)
        }

        currentUrlRef.current = audioUrl

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        // Set up event handlers before playing
        audio.onplay = () => {
          setState("playing")
          onStart?.()
        }

        audio.onended = () => {
          setState("idle")
          audioRef.current = null
          onEnd?.()
        }

        audio.onerror = (e) => {
          console.error("Audio playback error:", e)
          setState("error")
          setErrorMessage("Failed to play audio")
          audioRef.current = null
          onError?.("Failed to play audio")
        }

        // Handle loading errors
        audio.onloadeddata = () => {
          console.log("TTS: Audio loaded, duration:", audio.duration)
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
