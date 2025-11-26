"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, ReactNode, useContext } from "react"
import type {
  UserMemory,
  CreateMemoryRequest,
  SearchMemoriesRequest,
  MemorySearchResult,
  MemoryStats,
} from "@/lib/memory/types"

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface MemoryContextType {
  // Data
  memories: UserMemory[]
  stats: MemoryStats | null
  isLoading: boolean
  error: Error | null

  // Actions
  createMemory: (content: string, metadata?: CreateMemoryRequest["metadata"]) => Promise<UserMemory | null>
  updateMemory: (id: string, updates: Partial<UserMemory>) => Promise<UserMemory | null>
  deleteMemory: (id: string) => Promise<boolean>
  searchMemories: (query: string, options?: Partial<SearchMemoriesRequest>) => Promise<MemorySearchResult[]>
  refresh: () => Promise<void>
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined)

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchMemories(): Promise<{ memories: UserMemory[]; stats: MemoryStats }> {
  const response = await fetch("/api/memories")
  if (!response.ok) {
    throw new Error("Failed to fetch memories")
  }
  const data = await response.json()
  return {
    memories: data.memories || [],
    stats: data.stats || null,
  }
}

async function createMemoryApi(data: CreateMemoryRequest): Promise<UserMemory> {
  const response = await fetch("/api/memories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create memory")
  }

  const result = await response.json()
  return result.memory
}

async function updateMemoryApi(id: string, updates: Partial<UserMemory>): Promise<UserMemory> {
  const response = await fetch(`/api/memories/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update memory")
  }

  const result = await response.json()
  return result.memory
}

async function deleteMemoryApi(id: string): Promise<boolean> {
  const response = await fetch(`/api/memories/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to delete memory")
  }

  return true
}

async function searchMemoriesApi(params: SearchMemoriesRequest): Promise<MemorySearchResult[]> {
  const response = await fetch("/api/memories/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to search memories")
  }

  const result = await response.json()
  return result.results || []
}

// ============================================================================
// PROVIDER
// ============================================================================

export function MemoryProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const queryClient = useQueryClient()

  // Fetch memories with automatic refetching to catch background-created memories
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["memories", userId],
    queryFn: fetchMemories,
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds (reduced from 5 minutes)
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds to catch background memories
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })

  const memories = data?.memories || []
  const stats = data?.stats || null

  // Create memory mutation
  const createMutation = useMutation({
    mutationFn: async (params: CreateMemoryRequest) => {
      return await createMemoryApi(params)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", userId] })
    },
  })

  // Update memory mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UserMemory> }) => {
      return await updateMemoryApi(id, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", userId] })
    },
  })

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteMemoryApi(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", userId] })
    },
  })

  // Search memories mutation
  const searchMutation = useMutation({
    mutationFn: async (params: SearchMemoriesRequest) => {
      return await searchMemoriesApi(params)
    },
  })

  // Context value
  const value: MemoryContextType = {
    memories,
    stats,
    isLoading,
    error: error as Error | null,

    createMemory: async (content: string, metadata?: CreateMemoryRequest["metadata"]) => {
      try {
        const memory = await createMutation.mutateAsync({
          content,
          metadata,
          memory_type: "explicit",
        })
        return memory
      } catch (err) {
        console.error("Failed to create memory:", err)
        return null
      }
    },

    updateMemory: async (id: string, updates: Partial<UserMemory>) => {
      try {
        const memory = await updateMutation.mutateAsync({ id, updates })
        return memory
      } catch (err) {
        console.error("Failed to update memory:", err)
        return null
      }
    },

    deleteMemory: async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id)
        return true
      } catch (err) {
        console.error("Failed to delete memory:", err)
        return false
      }
    },

    searchMemories: async (query: string, options?: Partial<SearchMemoriesRequest>) => {
      try {
        const results = await searchMutation.mutateAsync({
          query,
          ...options,
        })
        return results
      } catch (err) {
        console.error("Failed to search memories:", err)
        return []
      }
    },

    refresh: async () => {
      await refetch()
    },
  }

  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>
}

// ============================================================================
// HOOK
// ============================================================================

export function useMemory() {
  const context = useContext(MemoryContext)
  if (context === undefined) {
    throw new Error("useMemory must be used within a MemoryProvider")
  }
  return context
}
