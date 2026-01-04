/**
 * Presence Module
 * Real-time presence tracking and collaborative features
 */

// Types
export * from "./types"

// Providers
export { PresenceProvider, usePresence, usePresenceOptional } from "./provider"
export { ReadReceiptsProvider, useReadReceipts, useReadReceiptsContext } from "./read-receipts-provider"

// Hooks
export { useRevocationListener } from "./hooks/use-revocation-listener"
export { useCollaborativeMessages } from "./hooks/use-collaborative-messages"
export { useAutoMarkAsRead } from "./hooks/use-read-receipts"

// Re-export types for convenience
export type {
  AIStatus,
  AIStatusType,
  ExtendedPresenceContextValue,
} from "./types"
