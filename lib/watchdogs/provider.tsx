"use client"

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactNode,
} from "react"
import type {
  WatchdogsContextType,
  WatchdogsFilters,
  ClassifiedEvent,
  RawNewsArticle,
  EventCategory,
  EventSeverity,
  ConnectionStatus,
} from "./types"
import {
  DEFAULT_FILTERS,
  AI_CONFIG,
  getTimeRangeCutoff,
} from "./config"
import { useNewsStream } from "./news-client"
import { classifyEvents } from "./event-classifier"
import { geocodeEvents } from "./geocoder"

// Context
const WatchdogsContext = createContext<WatchdogsContextType | null>(null)

// Hook to use the context
export function useWatchdogs(): WatchdogsContextType {
  const context = useContext(WatchdogsContext)
  if (!context) {
    throw new Error("useWatchdogs must be used within WatchdogsProvider")
  }
  return context
}

// Persistence functions
async function loadPersistedEvents(): Promise<ClassifiedEvent[]> {
  try {
    const response = await fetch("/api/watchdogs/events?limit=200", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      console.warn("[Watchdogs] Failed to load persisted events:", response.status)
      return []
    }

    const data = await response.json()
    return data.events || []
  } catch (error) {
    console.warn("[Watchdogs] Error loading persisted events:", error)
    return []
  }
}

async function persistEvents(events: ClassifiedEvent[]): Promise<void> {
  if (events.length === 0) return

  try {
    const response = await fetch("/api/watchdogs/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    })

    if (!response.ok) {
      console.warn("[Watchdogs] Failed to persist events:", response.status)
    }
  } catch (error) {
    console.warn("[Watchdogs] Error persisting events:", error)
  }
}

async function dismissEventInDb(articleId: string): Promise<void> {
  try {
    await fetch("/api/watchdogs/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId, dismissed: true }),
    })
  } catch (error) {
    console.warn("[Watchdogs] Error dismissing event:", error)
  }
}

// Provider component
export function WatchdogsProvider({ children }: { children: ReactNode }) {
  // State
  const [events, setEvents] = useState<ClassifiedEvent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting")
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Refs for queue processing
  const eventQueueRef = useRef<RawNewsArticle[]>([])
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistQueueRef = useRef<ClassifiedEvent[]>([])
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load persisted events on mount
  useEffect(() => {
    let mounted = true

    async function loadEvents() {
      const persisted = await loadPersistedEvents()
      if (mounted && persisted.length > 0) {
        setEvents(persisted)
        console.log(`[Watchdogs] Loaded ${persisted.length} persisted events`)
      }
      if (mounted) {
        setIsLoaded(true)
      }
    }

    loadEvents()

    return () => {
      mounted = false
    }
  }, [])

  // Debounced persist function
  const schedulePersist = useCallback((newEvents: ClassifiedEvent[]) => {
    persistQueueRef.current.push(...newEvents)

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current)
    }

    // Batch persist after 5 seconds of inactivity
    persistTimeoutRef.current = setTimeout(() => {
      const toPersist = [...persistQueueRef.current]
      persistQueueRef.current = []
      if (toPersist.length > 0) {
        persistEvents(toPersist)
      }
    }, 5000)
  }, [])

  // Process queued events
  const processQueue = useCallback(async () => {
    if (eventQueueRef.current.length === 0) return

    const batch = eventQueueRef.current.splice(0, AI_CONFIG.maxBatchSize)
    setIsAIProcessing(true)

    try {
      // 1. Classify events via AI/keywords
      const classified = await classifyEvents(batch)

      // 2. Geocode events with locations
      const geocoded = await geocodeEvents(classified)

      // 3. Add to events list (prepend for newest first)
      setEvents((prev) => {
        const combined = [...geocoded, ...prev]
        // Keep only maxEventsStored
        return combined.slice(0, AI_CONFIG.maxEventsStored)
      })

      // 4. Schedule persistence
      schedulePersist(geocoded)
    } catch (err) {
      console.error("[Watchdogs] Error processing events:", err)
      setError(err instanceof Error ? err.message : "Failed to process events")
    } finally {
      setIsAIProcessing(false)
    }
  }, [schedulePersist])

  // Handle new article from WebSocket
  const handleNewArticle = useCallback((article: RawNewsArticle) => {
    eventQueueRef.current.push(article)

    // Debounce processing
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }
    processingTimeoutRef.current = setTimeout(processQueue, AI_CONFIG.processingDebounceMs)
  }, [processQueue])

  // WebSocket connection
  const { isConnected, error: wsError, reconnect: wsReconnect } = useNewsStream({
    onArticle: handleNewArticle,
    onConnect: () => {
      setConnectionStatus("connected")
      setError(null)
    },
    onDisconnect: () => setConnectionStatus("disconnected"),
    onError: (err) => {
      setConnectionStatus("error")
      setError(err.message)
    },
  })

  // Update connection status based on WebSocket state
  useEffect(() => {
    if (wsError) {
      setConnectionStatus("error")
    } else if (isConnected) {
      setConnectionStatus("connected")
    }
  }, [isConnected, wsError])

  // Filter actions
  const toggleCategory = useCallback((category: EventCategory) => {
    setFilters((prev) => {
      const next = new Set(prev.categories)
      if (next.has(category)) {
        // Don't allow removing all categories
        if (next.size > 1) {
          next.delete(category)
        }
      } else {
        next.add(category)
      }
      return { ...prev, categories: next }
    })
  }, [])

  const toggleSeverity = useCallback((severity: EventSeverity) => {
    setFilters((prev) => {
      const next = new Set(prev.severities)
      if (next.has(severity)) {
        if (next.size > 1) {
          next.delete(severity)
        }
      } else {
        next.add(severity)
      }
      return { ...prev, severities: next }
    })
  }, [])

  const setTimeRange = useCallback((range: WatchdogsFilters["timeRange"]) => {
    setFilters((prev) => ({ ...prev, timeRange: range }))
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Event actions
  const selectEvent = useCallback((eventId: string | null) => {
    setSelectedEventId(eventId)
  }, [])

  const dismissAlert = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, dismissed: true } : e))
    )
    // Persist dismissal
    dismissEventInDb(eventId)
  }, [])

  // Connection actions
  const reconnect = useCallback(() => {
    setConnectionStatus("connecting")
    setError(null)
    wsReconnect()
  }, [wsReconnect])

  // Clear actions
  const clearEvents = useCallback(() => {
    setEvents([])
    eventQueueRef.current = []
    persistQueueRef.current = []
  }, [])

  // Compute filtered events
  const filteredEvents = useMemo(() => {
    const cutoff = getTimeRangeCutoff(filters.timeRange)
    return events.filter((e) => {
      // Category filter
      if (!filters.categories.has(e.category)) return false
      // Severity filter
      if (!filters.severities.has(e.severity)) return false
      // Time filter
      if (new Date(e.classifiedAt) < cutoff) return false
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const searchText = `${e.rawArticle.title} ${e.summary} ${e.entities.join(" ")}`.toLowerCase()
        if (!searchText.includes(query)) return false
      }
      return true
    })
  }, [events, filters])

  // Compute stats
  const stats = useMemo(() => {
    const byCategory: Record<EventCategory, number> = {
      financial: 0,
      geopolitical: 0,
      natural: 0,
      regulatory: 0,
    }
    const bySeverity: Record<EventSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    let criticalAlerts = 0

    for (const event of filteredEvents) {
      byCategory[event.category]++
      bySeverity[event.severity]++
      if (event.severity === "critical" && event.alertGenerated && !event.dismissed) {
        criticalAlerts++
      }
    }

    // Calculate events per minute (last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentEvents = filteredEvents.filter((e) => new Date(e.classifiedAt) > fiveMinAgo)
    const eventsPerMinute = Math.round(recentEvents.length / 5)

    return {
      totalEvents: filteredEvents.length,
      byCategory,
      bySeverity,
      eventsPerMinute,
      criticalAlerts,
      lastUpdated: filteredEvents[0]?.classifiedAt || new Date().toISOString(),
    }
  }, [filteredEvents])

  // Clean up old events periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const cutoffTime = Date.now() - AI_CONFIG.eventRetentionHours * 60 * 60 * 1000
      setEvents((prev) =>
        prev.filter((e) => new Date(e.classifiedAt).getTime() > cutoffTime)
      )
    }, 60000) // Check every minute

    return () => clearInterval(cleanup)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Persist any remaining events
      if (persistQueueRef.current.length > 0) {
        persistEvents(persistQueueRef.current)
      }
    }
  }, [])

  // Context value
  const value: WatchdogsContextType = {
    events: filteredEvents,
    connectionStatus,
    filters,
    selectedEventId,
    isAIProcessing,
    eventQueue: eventQueueRef.current,
    stats,
    error,
    toggleCategory,
    toggleSeverity,
    setTimeRange,
    setSearchQuery,
    selectEvent,
    dismissAlert,
    reconnect,
    clearEvents,
  }

  return (
    <WatchdogsContext.Provider value={value}>
      {children}
    </WatchdogsContext.Provider>
  )
}
