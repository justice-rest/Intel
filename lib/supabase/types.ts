/**
 * Supabase client type utilities
 *
 * This file provides type-safe Supabase client types that work with both
 * server and browser clients from @supabase/ssr.
 *
 * The @supabase/ssr package returns a different type than @supabase/supabase-js,
 * so we use a permissive type alias for function parameters.
 */

import type { Database } from "@/app/types/database.types"

// Use 'any' for function parameters to allow both server and client Supabase instances
// This is necessary because @supabase/ssr and @supabase/supabase-js have incompatible types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = any

// Re-export Database type for convenience
export type { Database }

// Re-export table types for type-safe queries
export type { Tables, TablesInsert, TablesUpdate } from "@/app/types/database.types"
