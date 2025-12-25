"use client"

import { Chat } from "./chat"

interface ChatContainerProps {
  firstName?: string | null
}

export function ChatContainer({ firstName }: ChatContainerProps) {
  return <Chat firstName={firstName} />
}
