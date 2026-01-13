"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  WifiHigh,
  WifiSlash,
  Lightning,
  Globe,
  CloudLightning,
  Scales,
  Warning,
  X,
  ArrowsClockwise,
  Clock,
} from "@phosphor-icons/react"

import { WatchdogsProvider, useWatchdogs } from "@/lib/watchdogs/provider"
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  SEVERITY_COLORS,
  TIME_RANGES,
  formatNumber,
  formatRelativeTime,
} from "@/lib/watchdogs/config"
import type { EventCategory, EventSeverity, ClassifiedEvent } from "@/lib/watchdogs/types"

import "@/app/labs/batch-dashboard.css"

// Dynamic import for map (no SSR)
const DottedMap = dynamic(() => import("@/components/watchdogs/dotted-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[560px] bg-[var(--ds-background-100)] animate-pulse rounded-md flex items-center justify-center">
      <span className="text-[var(--ds-gray-500)] font-mono text-sm">Loading map...</span>
    </div>
  ),
})

// Category icons
const CATEGORY_ICONS: Record<EventCategory, React.ElementType> = {
  financial: Lightning,
  geopolitical: Globe,
  natural: CloudLightning,
  regulatory: Scales,
}

// Connection status indicator
function ConnectionStatus() {
  const { connectionStatus, reconnect } = useWatchdogs()

  const statusConfig = {
    connecting: { icon: ArrowsClockwise, label: "Connecting", color: "var(--ds-gray-500)", animate: true },
    connected: { icon: WifiHigh, label: "Live", color: "#45ffbc", animate: false },
    disconnected: { icon: WifiSlash, label: "Disconnected", color: "#ef4444", animate: false },
    error: { icon: Warning, label: "Error", color: "#ef4444", animate: false },
  }

  const config = statusConfig[connectionStatus]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: config.color }}
          animate={config.animate ? { opacity: [1, 0.5, 1] } : {}}
          transition={config.animate ? { duration: 1, repeat: Infinity } : {}}
        />
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>
      {(connectionStatus === "disconnected" || connectionStatus === "error") && (
        <button
          onClick={reconnect}
          className="p-1 rounded hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
          title="Reconnect"
        >
          <ArrowsClockwise className="w-4 h-4 text-[var(--ds-gray-500)]" />
        </button>
      )}
    </div>
  )
}

// Stats display with animated counters
function StatsDisplay() {
  const { stats, events, isAIProcessing } = useWatchdogs()
  const [displayStats, setDisplayStats] = useState(stats)

  // Animate stats changes
  useEffect(() => {
    setDisplayStats(stats)
  }, [stats])

  return (
    <div className="flex items-center gap-6 font-mono text-sm">
      <div className="flex items-center gap-2">
        <span className="text-[var(--ds-gray-500)] uppercase text-xs">Events</span>
        <span className="text-[var(--ds-gray-1000)] tabular-nums font-medium">
          {formatNumber(events.length)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {(Object.keys(CATEGORY_COLORS) as EventCategory[]).map((category) => {
          const Icon = CATEGORY_ICONS[category]
          const count = displayStats.byCategory[category]
          return (
            <div key={category} className="flex items-center gap-1" title={CATEGORY_LABELS[category]}>
              <Icon className="w-3.5 h-3.5" style={{ color: CATEGORY_COLORS[category] }} weight="fill" />
              <span className="text-[var(--ds-gray-1000)] tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
      {isAIProcessing && (
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-[#45ffbc]"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-[#45ffbc] text-xs uppercase">AI</span>
        </div>
      )}
    </div>
  )
}

// Alert banner for critical events
function AlertBanner() {
  const { events, dismissAlert } = useWatchdogs()

  const criticalEvents = useMemo(() =>
    events.filter(e => e.severity === "critical" && e.alertGenerated && !e.dismissed),
    [events]
  )

  if (criticalEvents.length === 0) return null

  const latestCritical = criticalEvents[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-[rgba(220,38,38,0.15)] to-[rgba(220,38,38,0.05)] border-b border-[rgba(220,38,38,0.3)] px-6 py-3 flex items-center gap-3"
    >
      <motion.div
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <Warning className="w-5 h-5 text-[#dc2626]" weight="fill" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs uppercase text-[#dc2626] mr-2">Critical</span>
        <span className="text-[var(--ds-gray-1000)] text-sm truncate">
          {latestCritical.summary || latestCritical.rawArticle.title}
        </span>
      </div>
      <span className="text-[var(--ds-gray-500)] text-xs font-mono">
        {formatRelativeTime(latestCritical.classifiedAt)}
      </span>
      {criticalEvents.length > 1 && (
        <span className="text-[var(--ds-gray-500)] text-xs font-mono">
          +{criticalEvents.length - 1} more
        </span>
      )}
      <button
        onClick={() => dismissAlert(latestCritical.id)}
        className="p-1 rounded hover:bg-[var(--ds-gray-alpha-100)] transition-colors"
      >
        <X className="w-4 h-4 text-[var(--ds-gray-500)]" />
      </button>
    </motion.div>
  )
}

// Category filter buttons
function CategoryFilters() {
  const { filters, toggleCategory } = useWatchdogs()

  return (
    <div className="flex items-center gap-2">
      {(Object.keys(CATEGORY_COLORS) as EventCategory[]).map((category) => {
        const Icon = CATEGORY_ICONS[category]
        const isActive = filters.categories.has(category)
        return (
          <button
            key={category}
            onClick={() => toggleCategory(category)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono uppercase tracking-wide transition-all
              ${isActive
                ? "border-current bg-[var(--ds-gray-alpha-100)]"
                : "border-[var(--ds-gray-300)] text-[var(--ds-gray-500)] opacity-50 hover:opacity-75"
              }
            `}
            style={{ color: isActive ? CATEGORY_COLORS[category] : undefined }}
          >
            <Icon className="w-3.5 h-3.5" weight={isActive ? "fill" : "regular"} />
            <span>{CATEGORY_LABELS[category]}</span>
          </button>
        )
      })}
    </div>
  )
}

// Time range selector
function TimeRangeSelector() {
  const { filters, setTimeRange } = useWatchdogs()

  return (
    <div className="flex items-center gap-1">
      <Clock className="w-4 h-4 text-[var(--ds-gray-500)]" />
      <select
        value={filters.timeRange}
        onChange={(e) => setTimeRange(e.target.value as typeof filters.timeRange)}
        className="bg-transparent border border-[var(--ds-gray-300)] rounded px-2 py-1 text-xs font-mono text-[var(--ds-gray-1000)] cursor-pointer"
      >
        {TIME_RANGES.map((range) => (
          <option key={range.value} value={range.value}>
            {range.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Event card component
function EventCard({ event, isSelected }: { event: ClassifiedEvent; isSelected: boolean }) {
  const { selectEvent } = useWatchdogs()
  const Icon = CATEGORY_ICONS[event.category]

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={() => selectEvent(isSelected ? null : event.id)}
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${isSelected
          ? "bg-[var(--ds-gray-alpha-200)] border border-[#45ffbc]"
          : "bg-[var(--ds-gray-alpha-100)] border border-transparent hover:bg-[var(--ds-gray-alpha-200)]"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: SEVERITY_COLORS[event.severity] }}
          />
          <Icon
            className="w-4 h-4 flex-shrink-0"
            style={{ color: CATEGORY_COLORS[event.category] }}
            weight="fill"
          />
        </div>
        <span className="text-[var(--ds-gray-500)] text-[10px] font-mono flex-shrink-0">
          {formatRelativeTime(event.classifiedAt)}
        </span>
      </div>
      <h4 className="text-sm font-medium text-[var(--ds-gray-1000)] line-clamp-2 mb-1">
        {event.summary || event.rawArticle.title}
      </h4>
      {event.location && (
        <div className="flex items-center gap-1 text-[10px] text-[var(--ds-gray-500)] font-mono">
          <Globe className="w-3 h-3" />
          <span>{event.location.name}</span>
        </div>
      )}
      {isSelected && event.impactPrediction && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-xs text-[var(--ds-gray-500)] mt-2 pt-2 border-t border-[var(--ds-gray-300)]"
        >
          {event.impactPrediction}
        </motion.p>
      )}
    </motion.article>
  )
}

// Feed column component
function FeedColumn({ category }: { category: EventCategory }) {
  const { events, filters, selectedEventId } = useWatchdogs()
  const Icon = CATEGORY_ICONS[category]

  const filteredEvents = useMemo(() =>
    events.filter(e => e.category === category).slice(0, 20),
    [events, category]
  )

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--ds-background-100)]">
      <div
        className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: `${CATEGORY_COLORS[category]}20` }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[category] }} weight="fill" />
          <h3
            className="font-mono text-xs uppercase tracking-wider font-medium"
            style={{ color: CATEGORY_COLORS[category] }}
          >
            {CATEGORY_LABELS[category]}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[var(--ds-gray-500)] bg-[var(--ds-gray-alpha-100)] px-2 py-0.5 rounded-full">
          {filteredEvents.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--ds-gray-500)]">
              <Icon className="w-8 h-8 opacity-30 mb-2" />
              <span className="text-xs font-mono">No events</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Live feed container
function LiveFeed() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--ds-gray-200)] rounded-lg overflow-hidden h-[350px]">
      <FeedColumn category="financial" />
      <FeedColumn category="geopolitical" />
      <FeedColumn category="natural" />
      <FeedColumn category="regulatory" />
    </div>
  )
}

// Main content component
function WatchdogsContent() {
  return (
    <div className="batch-app-container min-h-screen">
      {/* Header */}
      <header className="batch-header">
        <div className="batch-header-left">
          <Link href="/" className="batch-logo-link group/logo">
            <span className="batch-logo-wrapper">
              <img src="/PFPs/1.png" alt="Romy" className="batch-logo batch-logo-default" />
              <img src="/PFPs/2.png" alt="Romy" className="batch-logo batch-logo-hover" />
            </span>
            <span className="batch-logo-text">Romy</span>
          </Link>
          <span className="batch-header-divider">/</span>
          <Link href="/labs" className="batch-breadcrumb-link">Labs</Link>
          <span className="batch-header-divider">/</span>
          <h1 className="font-mono uppercase tracking-wider text-[#45ffbc]">Watchdogs</h1>
        </div>
        <div className="batch-header-right flex items-center gap-4">
          <ConnectionStatus />
          <Link href="/labs" className="flat-button">
            Back to Labs
          </Link>
        </div>
      </header>

      {/* Alert Banner */}
      <AnimatePresence>
        <AlertBanner />
      </AnimatePresence>

      {/* Main Content */}
      <div className="px-6 pb-6 space-y-4">
        {/* Filters Row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CategoryFilters />
          <div className="flex items-center gap-4">
            <StatsDisplay />
            <TimeRangeSelector />
          </div>
        </div>

        {/* Map Section */}
        <section className="relative rounded-lg overflow-hidden border border-[var(--ds-gray-200)]">
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-[var(--ds-background-100)]/80 backdrop-blur-sm px-3 py-1.5 rounded border border-[var(--ds-gray-200)]">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--ds-gray-500)]">
                Global Event Monitor
              </span>
            </div>
          </div>
          <DottedMap />
        </section>

        {/* Live Feed Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-sm uppercase tracking-wider text-[var(--ds-gray-500)]">
              Live Feed
            </h2>
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[#45ffbc]"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="font-mono text-xs text-[var(--ds-gray-500)]">Streaming</span>
            </div>
          </div>
          <LiveFeed />
        </section>
      </div>
    </div>
  )
}

// Main export with provider
export default function WatchdogsView() {
  return (
    <WatchdogsProvider>
      <WatchdogsContent />
    </WatchdogsProvider>
  )
}
