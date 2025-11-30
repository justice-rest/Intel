"use client"

import { useEffect, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { useUserPreferences } from "@/lib/user-preference-store/provider"

// Audio clip cache for toggle sound
const CLIPS: Record<string, HTMLAudioElement> = {}

function useClickSound() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (CLIPS["/click.wav"]) return

    const audio = new Audio("/click.wav")
    audio.preload = "auto"
    audio.load()
    CLIPS["/click.wav"] = audio
  }, [])

  return useCallback(() => {
    const audio = CLIPS["/click.wav"]
    if (!audio) return
    audio.volume = 0.3
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [])
}

export function InteractionPreferences() {
  const {
    preferences,
    setShowToolInvocations,
    setShowConversationPreviews,
  } = useUserPreferences()

  const playClick = useClickSound()

  return (
    <div className="space-y-6 pb-12">
      {/* Tool Invocations */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Tool invocations</h3>
            <p className="text-muted-foreground text-xs">
              Show tool execution details in conversations
            </p>
          </div>
          <Switch
            checked={preferences.showToolInvocations}
            onCheckedChange={(checked) => {
              playClick()
              setShowToolInvocations(checked)
            }}
          />
        </div>
      </div>
      {/* Conversation Previews */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Conversation previews</h3>
            <p className="text-muted-foreground text-xs">
              Show conversation previews in history
            </p>
          </div>
          <Switch
            checked={preferences.showConversationPreviews}
            onCheckedChange={(checked) => {
              playClick()
              setShowConversationPreviews(checked)
            }}
          />
        </div>
      </div>
    </div>
  )
}
