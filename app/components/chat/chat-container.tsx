"use client"

import { Chat } from "./chat"

interface ChatContainerProps {
  showWelcome?: boolean
  firstName?: string | null
  onWelcomeDismiss?: () => void
}

export function ChatContainer({
  showWelcome,
  firstName,
  onWelcomeDismiss,
}: ChatContainerProps) {
  return (
    <Chat
      showWelcome={showWelcome}
      firstName={firstName}
      onWelcomeDismiss={onWelcomeDismiss}
    />
  )
}
