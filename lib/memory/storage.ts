/**
 * Memory Storage Module
 *
 * Handles CRUD operations for user memories in Supabase
 */

import { createClient } from "@/lib/supabase/server"
import type {
  UserMemory,
  CreateMemory,
  UpdateMemory,
  MemoryStats,
} from "./types"
import { MAX_MEMORIES_PER_USER } from "./config"

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

/**
 * Create a new memory
 *
 * @param memory - Memory data to create
 * @returns Created memory record
 */
export async function createMemory(
  memory: CreateMemory
): Promise<UserMemory | null> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return null
    }

    // Check if user has reached memory limit
    const { count } = await (supabase as any)
      .from("user_memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", memory.user_id)

    if (count && count >= MAX_MEMORIES_PER_USER) {
      throw new Error(
        `Memory limit reached. Maximum ${MAX_MEMORIES_PER_USER} memories per user.`
      )
    }

    // Convert embedding array to JSON string for storage
    const embeddingString = JSON.stringify(memory.embedding)

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .insert({
        user_id: memory.user_id,
        content: memory.content,
        memory_type: memory.memory_type || "auto",
        importance_score: memory.importance_score ?? 0.5,
        metadata: (memory.metadata || {}) as any,
        embedding: embeddingString,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating memory:", error)
      throw error
    }

    return data as UserMemory
  } catch (error) {
    console.error("Failed to create memory:", error)
    return null
  }
}

/**
 * Create multiple memories in batch
 *
 * @param memories - Array of memories to create
 * @returns Array of created memory records
 */
export async function createMemories(
  memories: CreateMemory[]
): Promise<UserMemory[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return []
    }

    // Convert embeddings to JSON strings
    const memoriesToInsert = memories.map((m) => ({
      user_id: m.user_id,
      content: m.content,
      memory_type: m.memory_type || "auto",
      importance_score: m.importance_score ?? 0.5,
      metadata: (m.metadata || {}) as any,
      embedding: JSON.stringify(m.embedding),
    }))

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .insert(memoriesToInsert)
      .select()

    if (error) {
      console.error("Error creating memories:", error)
      throw error
    }

    return (data || []) as UserMemory[]
  } catch (error) {
    console.error("Failed to create memories:", error)
    return []
  }
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get memory by ID
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @returns Memory record or null
 */
export async function getMemoryById(
  memoryId: string,
  userId: string
): Promise<UserMemory | null> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return null
    }

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .select("*")
      .eq("id", memoryId)
      .eq("user_id", userId)
      .single()

    if (error) {
      console.error("Error fetching memory:", error)
      return null
    }

    return data as UserMemory
  } catch (error) {
    console.error("Failed to fetch memory:", error)
    return null
  }
}

/**
 * Get all memories for a user
 *
 * @param userId - User ID
 * @param limit - Optional limit on number of results
 * @param offset - Optional offset for pagination
 * @returns Array of memory records
 */
export async function getUserMemories(
  userId: string,
  limit?: number,
  offset?: number
): Promise<UserMemory[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return []
    }

    let query = (supabase as any)
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching user memories:", error)
      throw error
    }

    return (data || []) as UserMemory[]
  } catch (error) {
    console.error("Failed to fetch user memories:", error)
    return []
  }
}

/**
 * Get memories by type
 *
 * @param userId - User ID
 * @param memoryType - Memory type to filter by
 * @param limit - Optional limit
 * @returns Array of memory records
 */
export async function getMemoriesByType(
  userId: string,
  memoryType: "auto" | "explicit",
  limit?: number
): Promise<UserMemory[]> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return []
    }

    let query = (supabase as any)
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .eq("memory_type", memoryType)
      .order("importance_score", { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching memories by type:", error)
      throw error
    }

    return (data || []) as UserMemory[]
  } catch (error) {
    console.error("Failed to fetch memories by type:", error)
    return []
  }
}

/**
 * Get user memory statistics
 *
 * @param userId - User ID
 * @returns Memory statistics
 */
export async function getMemoryStats(userId: string): Promise<MemoryStats> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return {
        total_memories: 0,
        auto_memories: 0,
        explicit_memories: 0,
        avg_importance: 0,
        most_recent_memory: null,
      }
    }

    const { data, error } = await (supabase as any).rpc("get_user_memory_stats", {
      user_id_param: userId,
    })

    if (error) {
      console.error("Error fetching memory stats:", error)
      throw error
    }

    if (!data || data.length === 0) {
      return {
        total_memories: 0,
        auto_memories: 0,
        explicit_memories: 0,
        avg_importance: 0,
        most_recent_memory: null,
      }
    }

    return data[0] as MemoryStats
  } catch (error) {
    console.error("Failed to fetch memory stats:", error)
    return {
      total_memories: 0,
      auto_memories: 0,
      explicit_memories: 0,
      avg_importance: 0,
      most_recent_memory: null,
    }
  }
}

/**
 * Check if a similar memory already exists
 * Uses semantic search to find duplicates
 *
 * @param content - Memory content to check
 * @param userId - User ID
 * @param apiKey - API key for embedding generation
 * @param threshold - Similarity threshold (default 0.9)
 * @returns True if similar memory exists
 */
export async function memoryExists(
  content: string,
  userId: string,
  apiKey: string,
  threshold: number = 0.9
): Promise<boolean> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return false
    }

    // Generate embedding for the content
    const { generateEmbedding } = await import("@/lib/rag/embeddings")
    const { embedding } = await generateEmbedding(content, apiKey)

    // Search for similar memories (embedding must be passed as array for the DB function)
    const { data, error } = await (supabase as any).rpc("search_user_memories", {
      query_embedding: embedding as unknown as string, // RPC accepts vector type
      match_user_id: userId,
      match_count: 1,
      similarity_threshold: threshold,
    })

    if (error) {
      console.error("Error checking for duplicate memory:", error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error("Failed to check for duplicate memory:", error)
    return false
  }
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Update a memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @param updates - Fields to update
 * @returns Updated memory record
 */
export async function updateMemory(
  memoryId: string,
  userId: string,
  updates: UpdateMemory
): Promise<UserMemory | null> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return null
    }

    const updateData: any = {}

    if (updates.content !== undefined) {
      updateData.content = updates.content
    }

    if (updates.importance_score !== undefined) {
      updateData.importance_score = updates.importance_score
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata as any
    }

    if (updates.embedding !== undefined) {
      updateData.embedding = JSON.stringify(updates.embedding)
    }

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .update(updateData)
      .eq("id", memoryId)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating memory:", error)
      throw error
    }

    return data as UserMemory
  } catch (error) {
    console.error("Failed to update memory:", error)
    return null
  }
}

/**
 * Increment access count for a memory
 * Called automatically when memory is retrieved
 *
 * @param memoryId - Memory ID
 */
export async function incrementMemoryAccess(memoryId: string): Promise<void> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return
    }

    await (supabase as any).rpc("increment_memory_access", {
      memory_id: memoryId,
    })
  } catch (error) {
    console.error("Failed to increment memory access:", error)
    // Don't throw - this is a non-critical operation
  }
}

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

/**
 * Delete a memory
 *
 * @param memoryId - Memory ID
 * @param userId - User ID (for security check)
 * @returns Success status
 */
export async function deleteMemory(
  memoryId: string,
  userId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return false
    }

    const { error } = await (supabase as any)
      .from("user_memories")
      .delete()
      .eq("id", memoryId)
      .eq("user_id", userId)

    if (error) {
      console.error("Error deleting memory:", error)
      throw error
    }

    return true
  } catch (error) {
    console.error("Failed to delete memory:", error)
    return false
  }
}

/**
 * Delete all memories for a user
 *
 * @param userId - User ID
 * @returns Number of deleted memories
 */
export async function deleteAllMemories(userId: string): Promise<number> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return 0
    }

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .delete()
      .eq("user_id", userId)
      .select("id")

    if (error) {
      console.error("Error deleting all memories:", error)
      throw error
    }

    return data?.length || 0
  } catch (error) {
    console.error("Failed to delete all memories:", error)
    return 0
  }
}

/**
 * Delete memories by type
 *
 * @param userId - User ID
 * @param memoryType - Type to delete
 * @returns Number of deleted memories
 */
export async function deleteMemoriesByType(
  userId: string,
  memoryType: "auto" | "explicit"
): Promise<number> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return 0
    }

    const { data, error } = await (supabase as any)
      .from("user_memories")
      .delete()
      .eq("user_id", userId)
      .eq("memory_type", memoryType)
      .select("id")

    if (error) {
      console.error("Error deleting memories by type:", error)
      throw error
    }

    return data?.length || 0
  } catch (error) {
    console.error("Failed to delete memories by type:", error)
    return 0
  }
}

/**
 * Delete old or low-importance memories to make room
 * Keeps the most important and recent memories
 *
 * @param userId - User ID
 * @param keepCount - Number of memories to keep
 * @returns Number of deleted memories
 */
export async function pruneMemories(
  userId: string,
  keepCount: number = 100
): Promise<number> {
  try {
    const supabase = await createClient()
    if (!supabase) {
      console.error("Supabase not configured")
      return 0
    }

    // Get IDs of memories to keep (sorted by weighted score)
    const { data: memoriesToKeep } = await (supabase as any)
      .from("user_memories")
      .select("id")
      .eq("user_id", userId)
      .order("importance_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(keepCount)

    if (!memoriesToKeep || memoriesToKeep.length === 0) {
      return 0
    }

    const idsToKeep = memoriesToKeep.map((m: any) => m.id)

    // Delete all memories except the ones to keep
    const { data, error } = await (supabase as any)
      .from("user_memories")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${idsToKeep.join(",")})`)
      .select("id")

    if (error) {
      console.error("Error pruning memories:", error)
      throw error
    }

    return data?.length || 0
  } catch (error) {
    console.error("Failed to prune memories:", error)
    return 0
  }
}
