"use client"

import { useChatSession } from "./provider"
import { useStandaloneChatSession } from "./standalone-provider"

/**
 * Hook to get the current chat ID from either the standalone context (for split view)
 * or the URL-based context (for normal single chat view).
 * Priority: standalone context > URL-based context
 */
export function useChatId(): string | null {
  const urlSession = useChatSession()
  const standaloneSession = useStandaloneChatSession()

  // Standalone context takes priority (used in split view panels)
  return standaloneSession.chatId ?? urlSession.chatId
}
