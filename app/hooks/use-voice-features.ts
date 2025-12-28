"use client"

import { useQuery } from "@tanstack/react-query"

interface VoiceFeaturesResponse {
  available: boolean
  features: {
    speechToText: boolean
  }
}

/**
 * Hook to check if voice features (STT) are available
 * Returns availability status based on server-side Groq API key configuration
 */
export function useVoiceFeatures() {
  const { data, isLoading, error } = useQuery<VoiceFeaturesResponse>({
    queryKey: ["voice-features"],
    queryFn: async () => {
      const response = await fetch("/api/voice-features")
      if (!response.ok) {
        throw new Error("Failed to check voice features")
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  })

  return {
    isAvailable: data?.available ?? false,
    speechToTextEnabled: data?.features?.speechToText ?? false,
    isLoading,
    error,
  }
}
