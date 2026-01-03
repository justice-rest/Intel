"use client"

/**
 * Collaborators Provider
 * Manages state for chat collaborators and share links
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@/components/ui/toast"
import { getShareLinkUrl } from "./config"
import type {
  Collaborator,
  ShareLink,
  CollaboratorRole,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
} from "./types"

interface CollaboratorsContextValue {
  // State
  collaborators: Collaborator[]
  shareLinks: (ShareLink & { full_url: string; has_password: boolean })[]
  currentUserRole: CollaboratorRole | null
  isLoading: boolean
  isOwner: boolean
  canEdit: boolean
  canView: boolean

  // Actions
  createShareLink: (options: CreateShareLinkRequest) => Promise<CreateShareLinkResponse>
  revokeShareLink: (linkId: string) => Promise<void>
  updateCollaboratorRole: (userId: string, role: "editor" | "viewer") => Promise<void>
  removeCollaborator: (userId: string) => Promise<void>
  refresh: () => void
}

const CollaboratorsContext = createContext<CollaboratorsContextValue | null>(null)

export function useCollaborators() {
  const context = useContext(CollaboratorsContext)
  if (!context) {
    throw new Error("useCollaborators must be used within a CollaboratorsProvider")
  }
  return context
}

// Optional hook that returns null outside provider
export function useCollaboratorsOptional(): CollaboratorsContextValue | null {
  return useContext(CollaboratorsContext)
}

interface CollaboratorsProviderProps {
  chatId: string
  children: ReactNode
}

export function CollaboratorsProvider({ chatId, children }: CollaboratorsProviderProps) {
  const queryClient = useQueryClient()
  const [currentUserRole, setCurrentUserRole] = useState<CollaboratorRole | null>(null)

  // Fetch collaborators
  const {
    data: collaboratorsData,
    isLoading: collaboratorsLoading,
    refetch: refetchCollaborators,
  } = useQuery({
    queryKey: ["collaborators", chatId],
    queryFn: async () => {
      const res = await fetch(`/api/chats/${chatId}/collaborators`)
      if (!res.ok) {
        if (res.status === 403) {
          return { collaborators: [], currentUserRole: null }
        }
        throw new Error("Failed to fetch collaborators")
      }
      return res.json() as Promise<{
        collaborators: Collaborator[]
        currentUserRole: CollaboratorRole | null
      }>
    },
    enabled: !!chatId,
    staleTime: 30000, // 30 seconds
  })

  // Update current user role when data changes
  useEffect(() => {
    if (collaboratorsData?.currentUserRole) {
      setCurrentUserRole(collaboratorsData.currentUserRole)
    }
  }, [collaboratorsData?.currentUserRole])

  // Fetch share links (only if user is editor+)
  const {
    data: shareLinksData,
    isLoading: shareLinksLoading,
    refetch: refetchShareLinks,
  } = useQuery({
    queryKey: ["shareLinks", chatId],
    queryFn: async () => {
      const res = await fetch(`/api/chats/${chatId}/share-links`)
      if (!res.ok) {
        if (res.status === 403) {
          return { links: [] }
        }
        throw new Error("Failed to fetch share links")
      }
      return res.json() as Promise<{
        links: (ShareLink & { full_url: string; has_password: boolean })[]
      }>
    },
    enabled: !!chatId && currentUserRole !== "viewer",
    staleTime: 30000,
  })

  // Create share link mutation
  const createShareLinkMutation = useMutation({
    mutationFn: async (options: CreateShareLinkRequest) => {
      const res = await fetch(`/api/chats/${chatId}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create share link")
      }

      return res.json() as Promise<CreateShareLinkResponse>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareLinks", chatId] })
      toast({ title: "Share link created", status: "success" })
    },
    onError: (error: Error) => {
      toast({ title: error.message, status: "error" })
    },
  })

  // Revoke share link mutation
  const revokeShareLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await fetch(`/api/chats/${chatId}/share-links/${linkId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke share link")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareLinks", chatId] })
      toast({ title: "Share link revoked", status: "success" })
    },
    onError: (error: Error) => {
      toast({ title: error.message, status: "error" })
    },
  })

  // Update collaborator role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "editor" | "viewer" }) => {
      const res = await fetch(`/api/chats/${chatId}/collaborators/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update role")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", chatId] })
      toast({ title: "Role updated", status: "success" })
    },
    onError: (error: Error) => {
      toast({ title: error.message, status: "error" })
    },
  })

  // Remove collaborator mutation
  const removeCollaboratorMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/chats/${chatId}/collaborators/${userId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove collaborator")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", chatId] })
      toast({ title: "Collaborator removed", status: "success" })
    },
    onError: (error: Error) => {
      toast({ title: error.message, status: "error" })
    },
  })

  // Action handlers
  const createShareLink = useCallback(
    async (options: CreateShareLinkRequest) => {
      return createShareLinkMutation.mutateAsync(options)
    },
    [createShareLinkMutation]
  )

  const revokeShareLink = useCallback(
    async (linkId: string) => {
      await revokeShareLinkMutation.mutateAsync(linkId)
    },
    [revokeShareLinkMutation]
  )

  const updateCollaboratorRole = useCallback(
    async (userId: string, role: "editor" | "viewer") => {
      await updateRoleMutation.mutateAsync({ userId, role })
    },
    [updateRoleMutation]
  )

  const removeCollaborator = useCallback(
    async (userId: string) => {
      await removeCollaboratorMutation.mutateAsync(userId)
    },
    [removeCollaboratorMutation]
  )

  const refresh = useCallback(() => {
    refetchCollaborators()
    if (currentUserRole !== "viewer") {
      refetchShareLinks()
    }
  }, [refetchCollaborators, refetchShareLinks, currentUserRole])

  // Computed values
  const isOwner = currentUserRole === "owner"
  const canEdit = currentUserRole === "owner" || currentUserRole === "editor"
  const canView = currentUserRole !== null

  const value: CollaboratorsContextValue = {
    collaborators: collaboratorsData?.collaborators || [],
    shareLinks: shareLinksData?.links || [],
    currentUserRole,
    isLoading: collaboratorsLoading || shareLinksLoading,
    isOwner,
    canEdit,
    canView,
    createShareLink,
    revokeShareLink,
    updateCollaboratorRole,
    removeCollaborator,
    refresh,
  }

  return (
    <CollaboratorsContext.Provider value={value}>
      {children}
    </CollaboratorsContext.Provider>
  )
}
