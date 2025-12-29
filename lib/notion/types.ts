/**
 * Notion Integration Types
 *
 * TypeScript definitions for OAuth, API responses, and internal types
 */

// ============================================================================
// OAUTH TYPES
// ============================================================================

/**
 * Notion OAuth token (decrypted)
 * Note: Notion tokens do NOT expire, so no refresh token needed
 */
export interface NotionOAuthTokens {
  accessToken: string
}

/**
 * Notion OAuth token (encrypted for storage)
 */
export interface NotionOAuthTokensEncrypted {
  access_token_encrypted: string
  access_token_iv: string
  workspace_id: string
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string
  owner_id: string | null
  owner_email: string | null
  status: NotionConnectionStatus
  last_error: string | null
}

/**
 * Connection status
 */
export type NotionConnectionStatus = "active" | "revoked" | "error"

/**
 * OAuth token response from Notion
 */
export interface NotionTokenResponse {
  access_token: string
  bot_id: string
  duplicated_template_id: string | null
  owner: NotionOwner
  request_id?: string
  token_type: "bearer"
  workspace_icon: string | null
  workspace_id: string
  workspace_name: string | null
}

/**
 * Notion owner (user or workspace)
 */
export type NotionOwner =
  | {
      type: "user"
      user: {
        avatar_url?: string
        id: string
        name?: string
        object: "user"
        person?: {
          email?: string
        }
        type: "person"
      }
    }
  | {
      type: "workspace"
      workspace: true
    }

// ============================================================================
// INTEGRATION STATUS
// ============================================================================

/**
 * Full integration status for a user
 */
export interface NotionIntegrationStatus {
  connected: boolean
  status: NotionConnectionStatus | "disconnected"
  workspaceName?: string
  workspaceId?: string
  workspaceIcon?: string
  ownerEmail?: string
  errorMessage?: string
  indexedPages: number
  processingPages: number
  connectedAt?: string
}

// ============================================================================
// API TYPES - PAGES & DATABASES
// ============================================================================

/**
 * Notion page object
 */
export interface NotionPage {
  object: "page"
  id: string
  created_time: string
  last_edited_time: string
  created_by: NotionPartialUser
  last_edited_by: NotionPartialUser
  cover: NotionFile | null
  icon: NotionIcon | null
  parent: NotionParent
  archived: boolean
  properties: Record<string, NotionProperty>
  url: string
}

/**
 * Notion database object
 */
export interface NotionDatabase {
  object: "database"
  id: string
  created_time: string
  last_edited_time: string
  title: NotionRichText[]
  description: NotionRichText[]
  icon: NotionIcon | null
  cover: NotionFile | null
  parent: NotionParent
  url: string
  archived: boolean
  is_inline: boolean
  properties: Record<string, NotionDatabaseProperty>
}

/**
 * Search result (can be page or database)
 */
export type NotionSearchResult = NotionPage | NotionDatabase

/**
 * Search response
 */
export interface NotionSearchResponse {
  object: "list"
  results: NotionSearchResult[]
  next_cursor: string | null
  has_more: boolean
  type: "page_or_database"
}

// ============================================================================
// API TYPES - BLOCKS
// ============================================================================

/**
 * Block types we support
 */
export type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "table"
  | "table_row"
  | "divider"
  | "to_do"
  | "synced_block"
  | "column_list"
  | "column"
  | "child_page"
  | "child_database"
  | "embed"
  | "image"
  | "video"
  | "file"
  | "pdf"
  | "bookmark"
  | "equation"
  | "link_preview"
  | "unsupported"

/**
 * Base block structure
 */
export interface NotionBlock {
  object: "block"
  id: string
  parent: NotionParent
  type: NotionBlockType
  created_time: string
  last_edited_time: string
  created_by: NotionPartialUser
  last_edited_by: NotionPartialUser
  has_children: boolean
  archived: boolean
  // Type-specific content
  paragraph?: { rich_text: NotionRichText[]; color: string }
  heading_1?: { rich_text: NotionRichText[]; color: string; is_toggleable: boolean }
  heading_2?: { rich_text: NotionRichText[]; color: string; is_toggleable: boolean }
  heading_3?: { rich_text: NotionRichText[]; color: string; is_toggleable: boolean }
  bulleted_list_item?: { rich_text: NotionRichText[]; color: string }
  numbered_list_item?: { rich_text: NotionRichText[]; color: string }
  toggle?: { rich_text: NotionRichText[]; color: string }
  quote?: { rich_text: NotionRichText[]; color: string }
  callout?: { rich_text: NotionRichText[]; icon: NotionIcon; color: string }
  code?: { rich_text: NotionRichText[]; language: string; caption: NotionRichText[] }
  table?: { table_width: number; has_column_header: boolean; has_row_header: boolean }
  table_row?: { cells: NotionRichText[][] }
  to_do?: { rich_text: NotionRichText[]; checked: boolean; color: string }
  divider?: Record<string, never>
  child_page?: { title: string }
  child_database?: { title: string }
}

/**
 * Blocks list response
 */
export interface NotionBlocksResponse {
  object: "list"
  results: NotionBlock[]
  next_cursor: string | null
  has_more: boolean
  type: "block"
  block: Record<string, never>
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Rich text object
 */
export interface NotionRichText {
  type: "text" | "mention" | "equation"
  text?: {
    content: string
    link: { url: string } | null
  }
  mention?: NotionMention
  equation?: { expression: string }
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
  plain_text: string
  href: string | null
}

/**
 * Mention types
 */
export type NotionMention =
  | { type: "user"; user: NotionPartialUser }
  | { type: "page"; page: { id: string } }
  | { type: "database"; database: { id: string } }
  | { type: "date"; date: NotionDate }
  | { type: "link_preview"; link_preview: { url: string } }

/**
 * Partial user object
 */
export interface NotionPartialUser {
  object: "user"
  id: string
}

/**
 * Parent object
 */
export type NotionParent =
  | { type: "database_id"; database_id: string }
  | { type: "page_id"; page_id: string }
  | { type: "block_id"; block_id: string }
  | { type: "workspace"; workspace: true }

/**
 * Icon (emoji or file)
 */
export type NotionIcon =
  | { type: "emoji"; emoji: string }
  | { type: "external"; external: { url: string } }
  | { type: "file"; file: { url: string; expiry_time: string } }

/**
 * File object
 */
export type NotionFile =
  | { type: "external"; external: { url: string } }
  | { type: "file"; file: { url: string; expiry_time: string } }

/**
 * Date object
 */
export interface NotionDate {
  start: string
  end: string | null
  time_zone: string | null
}

/**
 * Property types (simplified)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionProperty = Record<string, any>

/**
 * Database property schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionDatabaseProperty = Record<string, any>

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

/**
 * Notion document tracking status
 */
export type NotionDocumentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "needs_reindex"

/**
 * Notion document in database
 */
export interface NotionDocument {
  id: string
  user_id: string
  notion_page_id: string
  notion_page_title: string
  notion_object_type: "page" | "database"
  notion_url: string | null
  notion_last_edited_time: string | null
  notion_parent_id: string | null
  notion_icon: string | null
  rag_document_id: string | null
  status: NotionDocumentStatus
  error_message: string | null
  word_count: number | null
  block_count: number | null
  content_hash: string | null
  last_synced_at: string
  last_checked_at: string
  created_at: string
  updated_at: string
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Notion API error
 */
export class NotionApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "NotionApiError"
  }
}

/**
 * Token error (revoked, etc.)
 */
export class NotionTokenError extends Error {
  constructor(
    message: string,
    public isRevoked: boolean = false
  ) {
    super(message)
    this.name = "NotionTokenError"
  }
}
