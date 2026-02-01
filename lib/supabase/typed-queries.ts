/**
 * Type-safe Supabase query helpers
 *
 * These helpers work around TypeScript inference issues with Supabase v2.93+
 * where complex generic types sometimes resolve to 'never'.
 *
 * Instead of adding type assertions everywhere, use these typed functions.
 */

import type { Database } from "@/app/types/database.types"

// Re-export table row types for convenience
export type Tables = Database["public"]["Tables"]
export type PdfBrandingRow = Tables["pdf_branding"]["Row"]
export type UserRow = Tables["users"]["Row"]
export type ChatRow = Tables["chats"]["Row"]
export type MessageRow = Tables["messages"]["Row"]
export type UserPreferencesRow = Tables["user_preferences"]["Row"]
export type UserKeysRow = Tables["user_keys"]["Row"]
// Note: knowledge_documents and knowledge_entities tables don't exist in current schema
// export type KnowledgeDocumentRow = Tables["knowledge_documents"]["Row"]
// export type KnowledgeEntitiesRow = Tables["knowledge_entities"]["Row"]
export type UserMemoriesRow = Tables["user_memories"]["Row"]
export type CRMConstituentsRow = Tables["crm_constituents"]["Row"]
export type CRMDonationsRow = Tables["crm_donations"]["Row"]
// Note: batch_jobs and batch_items tables don't exist in current schema
// export type BatchJobRow = Tables["batch_jobs"]["Row"]
// export type BatchItemRow = Tables["batch_items"]["Row"]

// Insert types
export type PdfBrandingInsert = Tables["pdf_branding"]["Insert"]
export type UserInsert = Tables["users"]["Insert"]
export type ChatInsert = Tables["chats"]["Insert"]
export type MessageInsert = Tables["messages"]["Insert"]
export type UserPreferencesInsert = Tables["user_preferences"]["Insert"]

// Update types
export type PdfBrandingUpdate = Tables["pdf_branding"]["Update"]
export type UserUpdate = Tables["users"]["Update"]
export type ChatUpdate = Tables["chats"]["Update"]
export type MessageUpdate = Tables["messages"]["Update"]
export type UserPreferencesUpdate = Tables["user_preferences"]["Update"]

/**
 * Type assertion helper for Supabase query results
 * Use this when the TypeScript compiler can't infer the correct type
 *
 * @example
 * const { data } = await supabase.from("users").select("*").single()
 * const user = asType<UserRow>(data)
 */
export function asType<T>(value: unknown): T {
  return value as T
}

/**
 * Type assertion helper for Supabase query results with null handling
 *
 * @example
 * const { data } = await supabase.from("users").select("*").single()
 * const user = asTypeOrNull<UserRow>(data)
 */
export function asTypeOrNull<T>(value: unknown): T | null {
  return value as T | null
}

/**
 * Type assertion helper for Supabase array results
 *
 * @example
 * const { data } = await supabase.from("users").select("*")
 * const users = asArray<UserRow>(data)
 */
export function asArray<T>(value: unknown): T[] {
  return (value ?? []) as T[]
}
