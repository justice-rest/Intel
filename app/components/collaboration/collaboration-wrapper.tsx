"use client"

/**
 * Collaboration Wrapper
 * Provides collaboration context to chat components
 * Only renders providers when chatId is available
 */

import { type ReactNode } from "react"
import { CollaboratorsProvider } from "@/lib/collaboration"
import { PresenceProvider, ReadReceiptsProvider } from "@/lib/presence"
import { ReactionsProvider } from "@/lib/reactions"
import { useRevocationListener } from "@/lib/presence/hooks/use-revocation-listener"
import { isSupabaseEnabled } from "@/lib/supabase/config"

interface CollaborationWrapperProps {
  chatId: string | null
  children: ReactNode
}

/**
 * Wraps children with collaboration providers when chatId is available
 * Gracefully degrades when Supabase is not enabled
 */
export function CollaborationWrapper({
  chatId,
  children,
}: CollaborationWrapperProps) {
  // Don't wrap if no chatId or Supabase not enabled
  if (!chatId || !isSupabaseEnabled) {
    return <>{children}</>
  }

  return (
    <CollaboratorsProvider chatId={chatId}>
      <PresenceProvider chatId={chatId}>
        <ReadReceiptsProvider chatId={chatId}>
          <ReactionsProvider chatId={chatId}>
            <RevocationHandler chatId={chatId} />
            {children}
          </ReactionsProvider>
        </ReadReceiptsProvider>
      </PresenceProvider>
    </CollaboratorsProvider>
  )
}

/**
 * Internal component that sets up revocation listener
 */
function RevocationHandler({ chatId }: { chatId: string }) {
  useRevocationListener({ chatId })
  return null
}
