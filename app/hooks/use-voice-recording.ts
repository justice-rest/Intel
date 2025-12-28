"use client"

import { useCallback, useRef, useState } from "react"

export type RecordingState = "idle" | "recording" | "processing" | "error"

interface UseVoiceRecordingOptions {
  onTranscription?: (text: string) => void
  onError?: (error: string) => void
}

interface UseVoiceRecordingReturn {
  state: RecordingState
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  isSupported: boolean
  errorMessage: string | null
}

// Detect best supported audio format for the browser
function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  // Fallback - let browser decide
  return ""
}

export function useVoiceRecording({
  onTranscription,
  onError,
}: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const [state, setState] = useState<RecordingState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Check if MediaRecorder is supported
  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    !!window.MediaRecorder

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    audioChunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage("Voice recording is not supported in this browser")
      onError?.("Voice recording is not supported in this browser")
      return
    }

    try {
      setErrorMessage(null)
      setState("idle")

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper works well with 16kHz
        },
      })

      streamRef.current = stream
      audioChunksRef.current = []

      const mimeType = getSupportedMimeType()
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {}

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = () => {
        setErrorMessage("Recording error occurred")
        setState("error")
        onError?.("Recording error occurred")
        cleanup()
      }

      // Start recording with 1-second chunks
      mediaRecorder.start(1000)
      setState("recording")
    } catch (error) {
      console.error("Failed to start recording:", error)

      let message = "Failed to start recording"
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          message = "Microphone access denied. Please allow microphone access."
        } else if (error.name === "NotFoundError") {
          message = "No microphone found. Please connect a microphone."
        } else if (error.name === "NotReadableError") {
          message = "Microphone is in use by another application."
        }
      }

      setErrorMessage(message)
      setState("error")
      onError?.(message)
      cleanup()
    }
  }, [isSupported, onError, cleanup])

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current

    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      return
    }

    setState("processing")

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        try {
          const mimeType = mediaRecorder.mimeType || "audio/webm"
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })

          // Send to transcription API
          const formData = new FormData()
          formData.append("audio", audioBlob, `recording.${mimeType.split("/")[1]?.split(";")[0] || "webm"}`)

          const response = await fetch("/api/speech-to-text", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.error || "Transcription failed")
          }

          const result = await response.json()

          if (result.text) {
            onTranscription?.(result.text)
          }

          setState("idle")
          setErrorMessage(null)
        } catch (error) {
          console.error("Transcription error:", error)
          const message = error instanceof Error ? error.message : "Transcription failed"
          setErrorMessage(message)
          setState("error")
          onError?.(message)
        } finally {
          cleanup()
          resolve()
        }
      }

      mediaRecorder.stop()
    })
  }, [onTranscription, onError, cleanup])

  const cancelRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current

    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop()
    }

    cleanup()
    setState("idle")
    setErrorMessage(null)
  }, [cleanup])

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
    errorMessage,
  }
}
