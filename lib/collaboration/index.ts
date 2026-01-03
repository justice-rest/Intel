/**
 * Collaboration Module
 * Multi-user chat collaboration with role-based permissions
 */

// Types
export * from "./types"

// Configuration
export * from "./config"

// API utilities (server-side only)
export * from "./api"

// Provider (client-side)
export { CollaboratorsProvider, useCollaborators, useCollaboratorsOptional } from "./provider"
