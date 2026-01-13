/**
 * Watchdogs Dashboard - Configuration
 */

import type { EventCategory, EventSeverity, WatchdogsFilters } from "./types"

// Category colors (matching plan)
export const CATEGORY_COLORS: Record<EventCategory, string> = {
  financial: "#3b82f6",    // Blue
  geopolitical: "#ef4444", // Red
  natural: "#f59e0b",      // Amber/Orange
  regulatory: "#8b5cf6",   // Purple
}

// Severity colors
export const SEVERITY_COLORS: Record<EventSeverity, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#6b7280",
}

// Category labels
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  financial: "Financial",
  geopolitical: "Geopolitical",
  natural: "Natural",
  regulatory: "Regulatory",
}

// Severity labels
export const SEVERITY_LABELS: Record<EventSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
}

// Keywords for fast pre-classification (reduce AI calls)
export const CATEGORY_KEYWORDS: Record<EventCategory, string[]> = {
  financial: [
    "IPO", "merger", "acquisition", "SEC", "earnings", "stock", "market",
    "trading", "investment", "bankruptcy", "dividend", "revenue", "profit",
    "shares", "hedge fund", "private equity", "NASDAQ", "NYSE", "S&P",
    "Dow Jones", "bonds", "yield", "interest rate", "Fed", "inflation"
  ],
  geopolitical: [
    "war", "sanctions", "military", "election", "treaty", "diplomacy",
    "summit", "conflict", "tariff", "invasion", "troops", "missile",
    "nuclear", "UN", "NATO", "allies", "embargo", "coup", "protest",
    "referendum", "border", "territory", "ceasefire", "negotiation"
  ],
  natural: [
    "earthquake", "hurricane", "flood", "wildfire", "tsunami", "tornado",
    "drought", "volcano", "storm", "disaster", "evacuation", "casualties",
    "damage", "relief", "FEMA", "emergency", "climate", "weather",
    "cyclone", "blizzard", "landslide", "monsoon"
  ],
  regulatory: [
    "regulation", "legislation", "law", "policy", "FDA", "FTC", "EPA",
    "compliance", "ban", "approval", "fine", "penalty", "antitrust",
    "privacy", "GDPR", "license", "permit", "ruling", "court", "judge",
    "lawsuit", "settlement", "appeal", "subpoena"
  ],
}

// Keywords for severity detection
export const SEVERITY_KEYWORDS: Record<EventSeverity, string[]> = {
  critical: [
    "breaking", "urgent", "emergency", "major", "crisis", "war",
    "crash", "disaster", "catastrophe", "attack", "explosion", "death",
    "killed", "casualties", "collapse", "pandemic"
  ],
  high: [
    "significant", "important", "alert", "warning", "surge", "plunge",
    "breaking news", "developing", "serious", "threat", "risk", "concern"
  ],
  medium: [
    "update", "report", "announce", "plan", "proposal", "consider",
    "review", "discuss", "statement", "meeting", "decision"
  ],
  low: [
    "minor", "routine", "scheduled", "expected", "preview", "outlook",
    "forecast", "analysis", "opinion", "commentary"
  ],
}

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  maxReconnectAttempts: 5,
  reconnectDelayBase: 3000, // 3 seconds
  pollFallbackInterval: 30000, // 30 seconds
}

// AI classification configuration
export const AI_CONFIG = {
  model: "x-ai/grok-4.1-fast", // Grok 4.1 Fast for news classification
  maxBatchSize: 10,
  processingDebounceMs: 2000,
  rateLimitPerMinute: 10,
  maxEventsStored: 500,
  eventRetentionHours: 24,
}

// News API configuration
export const NEWS_API_CONFIG = {
  // Polling interval (ms) - fetch new articles every 30 seconds
  pollIntervalMs: 30000,
  // Initial fetch delay
  initialDelayMs: 1000,
  // Max articles per request
  articlesPerRequest: 10,
  // API timeout
  timeoutMs: 15000,
}

// Map configuration
export const MAP_CONFIG = {
  width: 1000,
  height: 560,
  projection: {
    scale: 140,
    center: [15, 25] as [number, number],
    rotate: [0, 0, 0] as [number, number, number],
  },
  pixelSize: 3,
  animationDuration: 1.5,
}

// Stats configuration
export const STATS_CONFIG = {
  updateIntervalMs: 50, // 20 updates per second
  varianceMin: 0.7,
  varianceMax: 1.3,
  rateVarianceMin: 0.85,
  rateVarianceMax: 1.15,
}

// Time range options
export const TIME_RANGES = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "all", label: "All Time" },
] as const

// Default filters
export const DEFAULT_FILTERS: WatchdogsFilters = {
  categories: new Set<EventCategory>(["financial", "geopolitical", "natural", "regulatory"]),
  severities: new Set<EventSeverity>(["critical", "high", "medium", "low"]),
  timeRange: "6h",
  searchQuery: "",
}

// Default stats
export const DEFAULT_STATS = {
  totalEvents: 0,
  byCategory: {
    financial: 0,
    geopolitical: 0,
    natural: 0,
    regulatory: 0,
  },
  bySeverity: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
  eventsPerMinute: 0,
  criticalAlerts: 0,
  lastUpdated: new Date().toISOString(),
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US")
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return `${diffDay}d ago`
}

// Get time range cutoff
export function getTimeRangeCutoff(range: "1h" | "6h" | "24h" | "all"): Date {
  const now = new Date()
  switch (range) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000)
    case "6h":
      return new Date(now.getTime() - 6 * 60 * 60 * 1000)
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case "all":
      return new Date(0)
  }
}
