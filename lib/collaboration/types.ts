/**
 * Collaboration Types
 * Shared types for chat collaboration features
 */

// Role types with hierarchy: owner > editor > viewer
export type CollaboratorRole = "owner" | "editor" | "viewer"

// Rate limit configuration for password attempts
export const SHARE_LINK_RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 15,
} as const

// Collaborator record from database
export interface Collaborator {
  id: string
  chat_id: string
  user_id: string
  role: CollaboratorRole
  invited_by: string | null
  invited_via_link_id: string | null
  created_at: string
  updated_at: string
  // Joined user data
  user?: {
    id: string
    display_name: string | null
    email: string
    profile_image: string | null
  }
}

// Share link record from database
export interface ShareLink {
  id: string
  chat_id: string
  token: string
  password_hash: string | null
  grants_role: "editor" | "viewer"
  max_uses: number | null
  use_count: number
  label: string | null
  created_by: string
  failed_attempts: number
  last_failed_attempt_at: string | null
  is_active: boolean
  revoked_at: string | null
  revoked_by: string | null
  created_at: string
  updated_at: string
}

// Access log entry types
export type AccessLogAction =
  | "collaborator_added"
  | "collaborator_removed"
  | "role_changed"
  | "link_created"
  | "link_used"
  | "link_revoked"
  | "link_password_failed"
  | "ownership_transferred"

export interface AccessLogEntry {
  id: number
  chat_id: string
  actor_user_id: string | null
  target_user_id: string | null
  action: AccessLogAction
  details: Record<string, unknown>
  created_at: string
}

// API Request/Response types
export interface CreateShareLinkRequest {
  grants_role?: "editor" | "viewer"
  password?: string
  max_uses?: number | null
  label?: string
}

export interface CreateShareLinkResponse {
  id: string
  token: string
  full_url: string
  grants_role: "editor" | "viewer"
  has_password: boolean
  max_uses: number | null
  label: string | null
  created_at: string
}

export interface AcceptShareLinkRequest {
  token: string
  password?: string
}

export interface AcceptShareLinkResponse {
  success: true
  chat_id: string
  role: CollaboratorRole
  redirect_url: string
}

export interface UpdateCollaboratorRoleRequest {
  role: "editor" | "viewer"
}

// Presence types for real-time
export interface PresenceUser {
  user_id: string
  display_name: string
  profile_image: string | null
  online_at: number
  status: "active" | "idle" | "away"
}

export interface TypingUser {
  user_id: string
  display_name: string
  started_at: number
}

// Role hierarchy helper
export const ROLE_HIERARCHY: Record<CollaboratorRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
}

/**
 * Check if a role meets the minimum required role
 */
export function hasMinimumRole(
  userRole: CollaboratorRole | null,
  requiredRole: CollaboratorRole
): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get display label for a role
 */
export function getRoleLabel(role: CollaboratorRole): string {
  switch (role) {
    case "owner":
      return "Owner"
    case "editor":
      return "Can edit"
    case "viewer":
      return "Can view"
  }
}
