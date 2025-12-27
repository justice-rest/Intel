/**
 * Storage Bucket Cleanup for GDPR Deletion
 * Handles deletion of files in Supabase storage buckets
 * These are NOT auto-deleted by database CASCADE
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Use a more flexible type to handle tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

// Storage buckets that contain user data
const USER_STORAGE_BUCKETS = [
  'chat-attachments',
  'avatars',
  'rag-documents',
] as const

type StorageBucket = (typeof USER_STORAGE_BUCKETS)[number]

interface StorageCleanupResult {
  bucket: StorageBucket
  filesDeleted: number
  success: boolean
  error?: string
}

/**
 * Delete all files for a user from all storage buckets
 * Uses service role client for admin access
 */
export async function deleteUserStorageFiles(
  supabaseAdmin: AnySupabaseClient,
  userId: string
): Promise<StorageCleanupResult[]> {
  const results: StorageCleanupResult[] = []

  for (const bucket of USER_STORAGE_BUCKETS) {
    const result = await deleteFilesFromBucket(supabaseAdmin, bucket, userId)
    results.push(result)
  }

  return results
}

/**
 * Delete all files for a user from a specific bucket
 * Files are stored in {userId}/* folder structure
 */
async function deleteFilesFromBucket(
  supabaseAdmin: AnySupabaseClient,
  bucket: StorageBucket,
  userId: string
): Promise<StorageCleanupResult> {
  try {
    // List all files in the user's folder
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucket)
      .list(userId, {
        limit: 1000, // Process in batches if needed
      })

    if (listError) {
      // If folder doesn't exist, that's fine - no files to delete
      if (listError.message.includes('not found') || listError.message.includes('does not exist')) {
        return {
          bucket,
          filesDeleted: 0,
          success: true,
        }
      }

      return {
        bucket,
        filesDeleted: 0,
        success: false,
        error: listError.message,
      }
    }

    if (!files || files.length === 0) {
      return {
        bucket,
        filesDeleted: 0,
        success: true,
      }
    }

    // Build full paths for deletion
    const filePaths = files
      .filter(file => file.name !== '.emptyFolderPlaceholder') // Skip placeholder files
      .map(file => `${userId}/${file.name}`)

    if (filePaths.length === 0) {
      return {
        bucket,
        filesDeleted: 0,
        success: true,
      }
    }

    // Delete files in batches of 100 (Supabase limit)
    const BATCH_SIZE = 100
    let totalDeleted = 0

    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE)
      const { error: deleteError } = await supabaseAdmin.storage
        .from(bucket)
        .remove(batch)

      if (deleteError) {
        console.error(`Error deleting files from ${bucket}:`, deleteError)
        // Continue with other batches even if one fails
      } else {
        totalDeleted += batch.length
      }
    }

    // Also try to delete any nested folders (for chat attachments)
    await deleteNestedFolders(supabaseAdmin, bucket, userId)

    return {
      bucket,
      filesDeleted: totalDeleted,
      success: true,
    }
  } catch (error) {
    console.error(`Unexpected error cleaning up ${bucket}:`, error)
    return {
      bucket,
      filesDeleted: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete nested folders within a user's storage folder
 * Some buckets have nested structure like {userId}/{chatId}/file.pdf
 */
async function deleteNestedFolders(
  supabaseAdmin: AnySupabaseClient,
  bucket: StorageBucket,
  userId: string
): Promise<void> {
  try {
    // List items that might be folders
    const { data: items } = await supabaseAdmin.storage
      .from(bucket)
      .list(userId)

    if (!items) return

    // For each potential subfolder, list and delete its contents
    for (const item of items) {
      // Check if it's a folder by trying to list its contents
      const { data: subItems } = await supabaseAdmin.storage
        .from(bucket)
        .list(`${userId}/${item.name}`)

      if (subItems && subItems.length > 0) {
        const subPaths = subItems
          .filter(f => f.name !== '.emptyFolderPlaceholder')
          .map(f => `${userId}/${item.name}/${f.name}`)

        if (subPaths.length > 0) {
          await supabaseAdmin.storage.from(bucket).remove(subPaths)
        }
      }
    }
  } catch {
    // Nested folder cleanup is best-effort
  }
}

/**
 * Get storage usage summary for a user
 * Useful for showing what will be deleted
 */
export async function getUserStorageStats(
  supabaseAdmin: AnySupabaseClient,
  userId: string
): Promise<{ bucket: StorageBucket; fileCount: number; totalSize: number }[]> {
  const stats: { bucket: StorageBucket; fileCount: number; totalSize: number }[] = []

  for (const bucket of USER_STORAGE_BUCKETS) {
    try {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(userId, { limit: 1000 })

      if (files && files.length > 0) {
        const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
        stats.push({
          bucket,
          fileCount: files.filter(f => f.name !== '.emptyFolderPlaceholder').length,
          totalSize,
        })
      } else {
        stats.push({ bucket, fileCount: 0, totalSize: 0 })
      }
    } catch {
      stats.push({ bucket, fileCount: 0, totalSize: 0 })
    }
  }

  return stats
}
