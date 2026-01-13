/**
 * Watchdogs Dashboard - Type Definitions
 * Real-time global intelligence dashboard
 */

// Event category types
export type EventCategory = "financial" | "geopolitical" | "natural" | "regulatory"

// Event severity levels
export type EventSeverity = "critical" | "high" | "medium" | "low"

// Connection status for WebSocket
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"

// Raw news article from realtime-newsapi
export interface RawNewsArticle {
  id: string
  title: string
  description: string
  symbols?: string[]
  url: string
  publishedAt: string
  source: string
}

// Location data for map markers
export interface EventLocation {
  name: string
  countryCode: string
  lat: number
  lng: number
  type: "city" | "country" | "region"
}

// Classification method
export type ClassificationMethod = "grok" | "keywords"

// Classified event after AI processing
export interface ClassifiedEvent {
  id: string
  rawArticle: RawNewsArticle

  // AI-generated fields
  category: EventCategory
  severity: EventSeverity
  summary: string
  impactPrediction: string
  entities: string[]

  // Location data
  location?: EventLocation

  // Metadata
  classifiedAt: string
  alertGenerated: boolean
  dismissed: boolean
  classifiedBy?: ClassificationMethod // "grok" for AI, "keywords" for fallback
}

// Stats for the dashboard
export interface WatchdogsStats {
  totalEvents: number
  byCategory: Record<EventCategory, number>
  bySeverity: Record<EventSeverity, number>
  eventsPerMinute: number
  criticalAlerts: number
  lastUpdated: string
}

// Filter state
export interface WatchdogsFilters {
  categories: Set<EventCategory>
  severities: Set<EventSeverity>
  timeRange: "1h" | "6h" | "24h" | "all"
  searchQuery: string
}

// Main state interface
export interface WatchdogsState {
  events: ClassifiedEvent[]
  connectionStatus: ConnectionStatus
  filters: WatchdogsFilters
  selectedEventId: string | null
  isAIProcessing: boolean
  eventQueue: RawNewsArticle[]
  stats: WatchdogsStats
  error: string | null
}

// Actions for state updates
export interface WatchdogsActions {
  // Filter actions
  toggleCategory: (category: EventCategory) => void
  toggleSeverity: (severity: EventSeverity) => void
  setTimeRange: (range: WatchdogsFilters["timeRange"]) => void
  setSearchQuery: (query: string) => void

  // Event actions
  selectEvent: (eventId: string | null) => void
  dismissAlert: (eventId: string) => void

  // Connection actions
  reconnect: () => void

  // Clear actions
  clearEvents: () => void
}

// Combined context type
export type WatchdogsContextType = WatchdogsState & WatchdogsActions

// Region marker for map
export interface RegionMarker {
  id: string
  name: string
  coordinates: [number, number]
  category?: EventCategory
}

// Country data for map coloring
export interface CountryEventData {
  code: string
  name: string
  eventCount: number
  primaryCategory: EventCategory
  color: string
}

// Pixel data for dotted map
export interface PixelData {
  lon: number
  lat: number
  cityDistanceRank: number
}

// Map pixel types
export interface StaticPixelProps {
  x: number
  y: number
}

export interface AnimatedPixelProps {
  x: number
  y: number
  color: string
  canPulse: boolean
  cityDistanceRank: number
}

// Event marker on map
export interface EventMarkerData {
  id: string
  coordinates: [number, number]
  category: EventCategory
  severity: EventSeverity
  title: string
  summary: string
}

// API response types
export interface ClassifyResponse {
  events: ClassifiedEvent[]
  error?: string
}

export interface GeocodeResponse {
  location: EventLocation | null
  error?: string
}

// Hook return types
export interface UseNewsStreamReturn {
  isConnected: boolean
  error: Error | null
  reconnect: () => void
}

export interface UseAnimatedNumberReturn {
  value: number
  rate: number
}
