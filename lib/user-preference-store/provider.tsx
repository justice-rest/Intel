"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, ReactNode, useContext } from "react"
import {
  convertFromApiFormat,
  convertToApiFormat,
  defaultPreferences,
  validatePreferences,
  type LayoutType,
  type UserPreferences,
} from "./utils"
import { AVATAR_STYLES, AVATAR_COLORS } from "@/lib/utils/avatar"

export {
  type LayoutType,
  type UserPreferences,
  convertFromApiFormat,
  convertToApiFormat,
  validatePreferences,
}

const PREFERENCES_STORAGE_KEY = "user-preferences"
const LAYOUT_STORAGE_KEY = "preferred-layout"

interface UserPreferencesContextType {
  preferences: UserPreferences
  setLayout: (layout: LayoutType) => void
  setPromptSuggestions: (enabled: boolean) => void
  setShowToolInvocations: (enabled: boolean) => void
  setShowConversationPreviews: (enabled: boolean) => void
  setBetaFeaturesEnabled: (enabled: boolean) => void
  toggleModelVisibility: (modelId: string) => void
  isModelHidden: (modelId: string) => boolean
  cycleAvatarStyle: () => void
  isLoading: boolean
}

const UserPreferencesContext = createContext<
  UserPreferencesContextType | undefined
>(undefined)

async function fetchUserPreferences(): Promise<UserPreferences> {
  const response = await fetch("/api/user-preferences")
  if (!response.ok) {
    throw new Error("Failed to fetch user preferences")
  }
  const data = await response.json()
  const converted = convertFromApiFormat(data)
  // Validate to ensure all fields have valid values
  return validatePreferences(converted)
}

async function updateUserPreferences(
  update: Partial<UserPreferences>
): Promise<UserPreferences> {
  const response = await fetch("/api/user-preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(convertToApiFormat(update)),
  })

  if (!response.ok) {
    throw new Error("Failed to update user preferences")
  }

  const data = await response.json()
  const converted = convertFromApiFormat(data)
  // Validate to ensure all fields have valid values
  return validatePreferences(converted)
}

function getLocalStoragePreferences(): UserPreferences {
  if (typeof window === "undefined") return defaultPreferences

  const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      // Validate and normalize to ensure all fields have valid values
      return validatePreferences(parsed)
    } catch {
      // fallback to legacy layout storage if JSON parsing fails
    }
  }

  // Check legacy layout storage
  const layout = localStorage.getItem(LAYOUT_STORAGE_KEY)
  if (layout === "sidebar" || layout === "fullscreen") {
    return {
      ...defaultPreferences,
      layout,
    }
  }

  return defaultPreferences
}

function saveToLocalStorage(preferences: UserPreferences) {
  if (typeof window === "undefined") return

  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  localStorage.setItem(LAYOUT_STORAGE_KEY, preferences.layout)
}

export function UserPreferencesProvider({
  children,
  userId,
  initialPreferences,
}: {
  children: ReactNode
  userId?: string
  initialPreferences?: UserPreferences
}) {
  const isAuthenticated = !!userId
  const queryClient = useQueryClient()

  // Merge initial preferences with defaults, always validating to ensure all fields exist
  const getInitialData = (): UserPreferences => {
    if (initialPreferences && isAuthenticated) {
      // Validate to ensure all fields have valid values even if some are missing
      return validatePreferences(initialPreferences)
    }

    if (!isAuthenticated) {
      return getLocalStoragePreferences()
    }

    return defaultPreferences
  }

  // Query for user preferences
  const { data: preferences = getInitialData(), isLoading } =
    useQuery<UserPreferences>({
      queryKey: ["user-preferences", userId],
      queryFn: async () => {
        if (!isAuthenticated) {
          return getLocalStoragePreferences()
        }

        try {
          return await fetchUserPreferences()
        } catch (error) {
          console.error(
            "Failed to fetch user preferences, falling back to localStorage:",
            error
          )
          return getLocalStoragePreferences()
        }
      },
      enabled: typeof window !== "undefined",
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Only retry for authenticated users and network errors
        return isAuthenticated && failureCount < 2
      },
      // Use initial data if available to avoid unnecessary API calls
      initialData:
        initialPreferences && isAuthenticated ? getInitialData() : undefined,
    })

  // Mutation for updating preferences
  const mutation = useMutation({
    mutationFn: async (update: Partial<UserPreferences>) => {
      const updated = { ...preferences, ...update }

      if (!isAuthenticated) {
        saveToLocalStorage(updated)
        return updated
      }

      try {
        return await updateUserPreferences(update)
      } catch (error) {
        console.error(
          "Failed to update user preferences in database, falling back to localStorage:",
          error
        )
        saveToLocalStorage(updated)
        return updated
      }
    },
    onMutate: async (update) => {
      const queryKey = ["user-preferences", userId]
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<UserPreferences>(queryKey)
      const optimistic = { ...previous, ...update }
      queryClient.setQueryData(queryKey, optimistic)

      return { previous }
    },
    onError: (_err, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["user-preferences", userId], context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user-preferences", userId], data)
    },
  })

  const updatePreferences = mutation.mutate

  const setLayout = (layout: LayoutType) => {
    if (isAuthenticated || layout === "fullscreen") {
      updatePreferences({ layout })
    }
  }

  const setPromptSuggestions = (enabled: boolean) => {
    updatePreferences({ promptSuggestions: enabled })
  }

  const setShowToolInvocations = (enabled: boolean) => {
    updatePreferences({ showToolInvocations: enabled })
  }

  const setShowConversationPreviews = (enabled: boolean) => {
    updatePreferences({ showConversationPreviews: enabled })
  }

  const setBetaFeaturesEnabled = (enabled: boolean) => {
    updatePreferences({ betaFeaturesEnabled: enabled })
  }

  const toggleModelVisibility = (modelId: string) => {
    const currentHidden = preferences.hiddenModels || []
    const isHidden = currentHidden.includes(modelId)
    const newHidden = isHidden
      ? currentHidden.filter((id) => id !== modelId)
      : [...currentHidden, modelId]

    updatePreferences({ hiddenModels: newHidden })
  }

  const isModelHidden = (modelId: string) => {
    return (preferences.hiddenModels || []).includes(modelId)
  }

  const cycleAvatarStyle = () => {
    const currentStyle = preferences.avatarStyleIndex ?? 0
    const currentColor = preferences.avatarColorIndex ?? 0
    const nextStyle = (currentStyle + 1) % AVATAR_STYLES.length
    // Advance color when style wraps back to 0 — gives 10x10 = 100 unique combos
    const nextColor = nextStyle === 0
      ? (currentColor + 1) % AVATAR_COLORS.length
      : currentColor
    updatePreferences({
      avatarStyleIndex: nextStyle,
      avatarColorIndex: nextColor,
    })
  }

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        setLayout,
        setPromptSuggestions,
        setShowToolInvocations,
        setShowConversationPreviews,
        setBetaFeaturesEnabled,
        toggleModelVisibility,
        isModelHidden,
        cycleAvatarStyle,
        isLoading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext)
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider"
    )
  }
  return context
}
