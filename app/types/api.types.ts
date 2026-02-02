import type { Database, Json } from "@/app/types/database.types"

// Define Attachment type for backward compatibility (v4 → v5 migration)
// In v5, attachments are handled via FileUIPart in message parts
export interface Attachment {
  url: string
  name: string
  contentType: string
}

// Use any for SupabaseClientType to allow both server and browser clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClientType = any

export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: Json
  result?: Json
  toolInvocation?: {
    state: string
    step: number
    toolCallId: string
    toolName: string
    args?: Json
    result?: Json
  }
  reasoning?: string
  details?: Json[]
}

export interface Message {
  role: "user" | "assistant" | "system" | "data" | "tool" | "tool-call"
  content: string | null | ContentPart[]
  reasoning?: string
}

export interface ChatApiParams {
  userId: string
  model: string
  isAuthenticated: boolean
}

export interface LogUserMessageParams {
  supabase: SupabaseClientType
  userId: string
  chatId: string
  content: string
  attachments?: Attachment[]
  model: string
  isAuthenticated: boolean
  message_group_id?: string
}

export interface StoreAssistantMessageParams {
  supabase: SupabaseClientType
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
