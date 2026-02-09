/**
 * RAG Search Module
 * Performs vector similarity search using Supabase pgvector
 */

import { createClient } from "@/lib/supabase/server"
import type { RAGSearchResult, RAGStorageUsage } from "./types"
import {
  RAG_MAX_RESULTS,
  RAG_SIMILARITY_THRESHOLD,
  RAG_DOCUMENT_LIMIT,
  RAG_STORAGE_LIMIT,
  RAG_DAILY_UPLOAD_LIMIT,
} from "./config"

/**
 * Search for similar document chunks using vector similarity
 *
 * @param queryEmbedding - Query vector (3072 dimensions for Gemini)
 * @param userId - User ID to filter results
 * @param options - Search options
 * @returns Array of matching chunks with similarity scores
 */
export async function searchDocumentChunks(
  queryEmbedding: number[],
  userId: string,
  options: {
    maxResults?: number
    similarityThreshold?: number
    documentIds?: string[]
  } = {}
): Promise<RAGSearchResult[]> {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const {
    maxResults = RAG_MAX_RESULTS,
    similarityThreshold = RAG_SIMILARITY_THRESHOLD,
    documentIds = null,
  } = options

  try {
    // Format embedding as pgvector string: [0.1,0.2,0.3]
    // Note: While this creates a ~15KB string for 1536 dimensions,
    // it's the standard way to pass vectors to PostgREST RPC functions
    const embeddingString = `[${queryEmbedding.join(',')}]`

    // Call the search_rag_chunks function from Supabase
    const { data, error } = await supabase.rpc("search_rag_chunks", {
      query_embedding: embeddingString,
      match_user_id: userId,
      match_count: maxResults,
      similarity_threshold: similarityThreshold,
      filter_document_ids: documentIds,
    })

    if (error) {
      // If the function doesn't exist, provide a helpful error message
      if (error.message.includes("does not exist") || error.message.includes("function")) {
        throw new Error(
          `Database function 'search_rag_chunks' not found. Please run the RAG migration (migrations/004_add_rag_tables.sql) in your Supabase dashboard.`
        )
      }
      throw new Error(`Vector search failed: ${error.message}`)
    }

    return data || []
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`RAG search error: ${error.message}`)
    }
    throw new Error("RAG search failed: Unknown error")
  }
}

/**
 * Get storage usage statistics for a user
 *
 * @param userId - User ID
 * @returns Document count, total bytes, and chunk count
 */
export async function getStorageUsage(
  userId: string
): Promise<RAGStorageUsage> {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  try {
    const { data, error } = await supabase.rpc("get_rag_storage_usage", {
      user_id_param: userId,
    })

    if (error) {
      // If the function doesn't exist, provide a helpful error message
      if (error.message.includes("does not exist") || error.message.includes("function")) {
        throw new Error(
          `Database function 'get_rag_storage_usage' not found. Please run the RAG migration (migrations/004_add_rag_tables.sql) in your Supabase dashboard.`
        )
      }
      throw new Error(`Failed to get storage usage: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {
        document_count: 0,
        total_bytes: 0,
        chunk_count: 0,
      }
    }

    return {
      document_count: Number(data[0].document_count),
      total_bytes: Number(data[0].total_bytes),
      chunk_count: Number(data[0].chunk_count),
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Storage usage error: ${error.message}`)
    }
    throw new Error("Failed to retrieve storage usage")
  }
}

/**
 * Check if user can upload more documents
 *
 * @param userId - User ID
 * @param fileSize - Size of file to upload (bytes)
 * @throws Error if upload limit exceeded
 */
export async function checkUploadLimit(
  userId: string,
  fileSize: number
): Promise<void> {
  const usage = await getStorageUsage(userId)

  // Check document count limit
  if (usage.document_count >= RAG_DOCUMENT_LIMIT) {
    throw new Error(
      `Document limit reached (${RAG_DOCUMENT_LIMIT} max). Please delete some documents before uploading more.`
    )
  }

  // Check storage size limit
  if (usage.total_bytes + fileSize > RAG_STORAGE_LIMIT) {
    const remainingMB = Math.round(
      (RAG_STORAGE_LIMIT - usage.total_bytes) / (1024 * 1024)
    )
    throw new Error(
      `Storage limit exceeded. You have ${remainingMB}MB remaining, but this file requires ${Math.round(fileSize / (1024 * 1024))}MB.`
    )
  }

  // Check daily upload limit
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from("rag_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString())

  if (error) {
    throw new Error(`Failed to check daily upload limit: ${error.message}`)
  }

  if ((count || 0) >= RAG_DAILY_UPLOAD_LIMIT) {
    throw new Error(
      `Daily upload limit reached (${RAG_DAILY_UPLOAD_LIMIT} files per day). Please try again tomorrow.`
    )
  }
}

/**
 * Get all documents for a user
 *
 * @param userId - User ID
 * @returns Array of user's RAG documents
 */
export async function getUserDocuments(userId: string) {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const { data, error } = await supabase
    .from("rag_documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`)
  }

  return data || []
}

/**
 * Get a single document by ID
 *
 * @param documentId - Document ID
 * @param userId - User ID (for security check)
 * @returns Document data
 */
export async function getDocument(documentId: string, userId: string) {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const { data, error } = await supabase
    .from("rag_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch document: ${error.message}`)
  }

  return data
}

/**
 * Delete a document and all its chunks
 *
 * @param documentId - Document ID
 * @param userId - User ID (for security check)
 */
export async function deleteDocument(documentId: string, userId: string) {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  // Get document to get file URL for storage deletion
  const document = await getDocument(documentId, userId)

  // Delete from database (chunks will cascade delete)
  const { error: deleteError } = await supabase
    .from("rag_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId)

  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`)
  }

  // Delete file from storage (skip for web-imported docs — they have no storage file)
  const sourceUrl = (document as Record<string, unknown>).source_url
  if (document.file_url && !sourceUrl) {
    try {
      // Extract path from URL
      const url = new URL(document.file_url)
      const pathMatch = url.pathname.match(/\/rag-documents\/(.+)/)

      if (pathMatch) {
        const filePath = pathMatch[1]

        const { error: storageError } = await supabase.storage
          .from("rag-documents")
          .remove([filePath])

        if (storageError) {
          console.error("Failed to delete file from storage:", storageError)
          // Don't throw - document is already deleted from DB
        }
      }
    } catch (error) {
      console.error("Error parsing file URL for deletion:", error)
      // Don't throw - document is already deleted from DB
    }
  }
}

/**
 * Update document tags
 *
 * @param documentId - Document ID
 * @param userId - User ID (for security check)
 * @param tags - New tags array
 */
export async function updateDocumentTags(
  documentId: string,
  userId: string,
  tags: string[]
) {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const { error } = await supabase
    .from("rag_documents")
    .update({ tags })
    .eq("id", documentId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to update tags: ${error.message}`)
  }
}

/**
 * Search documents by name or tags
 *
 * @param userId - User ID
 * @param query - Search query
 * @returns Matching documents
 */
export async function searchDocuments(userId: string, query: string) {
  const supabase = await createClient()

  if (!supabase) {
    throw new Error("Database not configured")
  }

  const { data, error } = await supabase
    .from("rag_documents")
    .select("*")
    .eq("user_id", userId)
    .or(
      `file_name.ilike.%${query}%,tags.cs.{${query}}`
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`)
  }

  return data || []
}
