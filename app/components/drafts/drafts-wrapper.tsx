"use client"

import { DraftsProvider, useDrafts } from "./drafts-context"
import { DraftsModal } from "./drafts-modal"

/**
 * Internal component that uses the drafts context
 */
function DraftsModalContainer() {
  const { isOpen, closeDraftsModal, refetchDrafts } = useDrafts()

  return (
    <DraftsModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDraftsModal()
        }
        // Refetch when modal opens to get latest
        if (open) {
          refetchDrafts()
        }
      }}
    />
  )
}

/**
 * Wrapper component that provides drafts context and renders the modal
 * Add this to your layout to enable drafts functionality
 */
export function DraftsWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DraftsProvider>
      {children}
      <DraftsModalContainer />
    </DraftsProvider>
  )
}
