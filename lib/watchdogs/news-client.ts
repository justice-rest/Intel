"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { RawNewsArticle, UseNewsStreamReturn } from "./types"
import { WEBSOCKET_CONFIG, NEWS_API_CONFIG } from "./config"

interface UseNewsStreamOptions {
  onArticle: (article: RawNewsArticle) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

/**
 * Hook for connecting to the real-time news stream
 * Uses server-side API route with polling
 */
export function useNewsStream(options: UseNewsStreamOptions): UseNewsStreamReturn {
  const { onArticle, onConnect, onDisconnect, onError } = options
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reconnectAttemptsRef = useRef(0)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const seenArticleIdsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)

  // Fetch news from API route
  const fetchNews = useCallback(async (): Promise<RawNewsArticle[]> => {
    try {
      const response = await fetch("/api/watchdogs/news", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(NEWS_API_CONFIG.timeoutMs),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()
      return data.articles || []
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch news")
      console.error("[NewsClient] Fetch error:", error)
      throw error
    }
  }, [])

  // Poll for news
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return

    console.log("[NewsClient] Starting polling mode")
    setIsConnected(true)
    onConnect?.()

    // Initial fetch
    const doFetch = async () => {
      if (!isMountedRef.current) return

      try {
        const articles = await fetchNews()

        // Filter out already seen articles
        const newArticles = articles.filter((article) => {
          if (seenArticleIdsRef.current.has(article.id)) {
            return false
          }
          seenArticleIdsRef.current.add(article.id)
          return true
        })

        // Process new articles
        newArticles.forEach(onArticle)

        // Reset error state on successful fetch
        if (error) {
          setError(null)
        }
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error("Fetch failed")
        console.error("[NewsClient] Poll error:", fetchError)

        // Don't disconnect on transient errors, just log
        if (reconnectAttemptsRef.current < WEBSOCKET_CONFIG.maxReconnectAttempts) {
          reconnectAttemptsRef.current++
        } else {
          setError(fetchError)
          onError?.(fetchError)
        }
      }
    }

    // Initial fetch after short delay
    setTimeout(() => {
      if (isMountedRef.current) {
        doFetch()
      }
    }, NEWS_API_CONFIG.initialDelayMs)

    // Set up polling interval
    pollIntervalRef.current = setInterval(doFetch, NEWS_API_CONFIG.pollIntervalMs)
  }, [fetchNews, onArticle, onConnect, onError, error])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  // Connect function
  const connect = useCallback(async () => {
    try {
      console.log("[NewsClient] Connecting to news feed...")
      startPolling()
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to connect")
      console.error("[NewsClient] Connection error:", error)
      setError(error)
      setIsConnected(false)
      onError?.(error)

      // Try reconnecting
      if (reconnectAttemptsRef.current < WEBSOCKET_CONFIG.maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        const delay = WEBSOCKET_CONFIG.reconnectDelayBase * reconnectAttemptsRef.current
        console.log(`[NewsClient] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
        setTimeout(connect, delay)
      }
    }
  }, [onError, startPolling])

  // Reconnect function
  const reconnect = useCallback(() => {
    console.log("[NewsClient] Manual reconnect requested")
    stopPolling()
    setError(null)
    setIsConnected(false)
    reconnectAttemptsRef.current = 0
    seenArticleIdsRef.current.clear() // Clear seen articles on reconnect
    onDisconnect?.()

    // Small delay before reconnecting
    setTimeout(connect, 500)
  }, [connect, stopPolling, onDisconnect])

  // Connect on mount
  useEffect(() => {
    isMountedRef.current = true
    connect()

    return () => {
      isMountedRef.current = false
      stopPolling()
      onDisconnect?.()
    }
  }, [connect, stopPolling, onDisconnect])

  return {
    isConnected,
    error,
    reconnect,
  }
}
