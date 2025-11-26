"use client"

import { useSearchParams, useRouter } from "next/navigation"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react"
import type { SplitViewContextType, SplitViewState } from "./types"

const SplitViewContext = createContext<SplitViewContextType | null>(null)

export function useSplitView() {
  const context = useContext(SplitViewContext)
  if (!context) {
    throw new Error("useSplitView must be used within SplitViewProvider")
  }
  return context
}

export function SplitViewProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [state, setState] = useState<SplitViewState>({
    isActive: false,
    leftChatId: null,
    rightChatId: null,
    splitRatio: 0.5,
  })

  // Initialize from URL on mount - only activate if split param exists
  // If split param is removed (e.g., navigating away), deactivate
  useEffect(() => {
    const splitParam = searchParams?.get("split")
    if (splitParam) {
      const ids = splitParam.split(",")
      if (ids.length === 2 && ids[0] && ids[1]) {
        setState({
          isActive: true,
          leftChatId: ids[0],
          rightChatId: ids[1],
          splitRatio: 0.5,
        })
      }
    } else {
      // No split param in URL - ensure split view is deactivated
      setState((prev) => {
        if (prev.isActive) {
          return {
            isActive: false,
            leftChatId: null,
            rightChatId: null,
            splitRatio: 0.5,
          }
        }
        return prev
      })
    }
  }, [searchParams])

  // Sync state to URL - use router for proper Next.js integration
  const updateUrl = useCallback(
    (newState: SplitViewState) => {
      const url = new URL(window.location.href)
      if (newState.isActive && newState.leftChatId && newState.rightChatId) {
        url.searchParams.set(
          "split",
          `${newState.leftChatId},${newState.rightChatId}`
        )
      } else {
        url.searchParams.delete("split")
      }
      // Use replaceState for immediate update, Next.js will sync on navigation
      window.history.replaceState({}, "", url.pathname + url.search)
    },
    []
  )

  const activateSplit = useCallback(
    (leftId: string, rightId: string) => {
      const newState: SplitViewState = {
        isActive: true,
        leftChatId: leftId,
        rightChatId: rightId,
        splitRatio: 0.5,
      }
      setState(newState)
      updateUrl(newState)
    },
    [updateUrl]
  )

  const deactivateSplit = useCallback(() => {
    const newState: SplitViewState = {
      isActive: false,
      leftChatId: null,
      rightChatId: null,
      splitRatio: 0.5,
    }
    setState(newState)
    updateUrl(newState)
  }, [updateUrl])

  const swapPanels = useCallback(() => {
    setState((prev) => {
      const newState: SplitViewState = {
        ...prev,
        leftChatId: prev.rightChatId,
        rightChatId: prev.leftChatId,
      }
      updateUrl(newState)
      return newState
    })
  }, [updateUrl])

  const closePanel = useCallback(
    (side: "left" | "right") => {
      const remainingChatId =
        side === "left" ? state.rightChatId : state.leftChatId
      deactivateSplit()
      if (remainingChatId) {
        router.push(`/c/${remainingChatId}`)
      }
    },
    [state.leftChatId, state.rightChatId, deactivateSplit, router]
  )

  const setSplitRatio = useCallback((ratio: number) => {
    setState((prev) => ({
      ...prev,
      splitRatio: Math.max(0.25, Math.min(0.75, ratio)),
    }))
  }, [])

  const replacePanel = useCallback(
    (side: "left" | "right", chatId: string) => {
      setState((prev) => {
        const newState: SplitViewState = {
          ...prev,
          [side === "left" ? "leftChatId" : "rightChatId"]: chatId,
        }
        updateUrl(newState)
        return newState
      })
    },
    [updateUrl]
  )

  const value = useMemo<SplitViewContextType>(
    () => ({
      ...state,
      activateSplit,
      deactivateSplit,
      swapPanels,
      closePanel,
      setSplitRatio,
      replacePanel,
    }),
    [
      state,
      activateSplit,
      deactivateSplit,
      swapPanels,
      closePanel,
      setSplitRatio,
      replacePanel,
    ]
  )

  return (
    <SplitViewContext.Provider value={value}>
      {children}
    </SplitViewContext.Provider>
  )
}
