"use client"

import { useMemo, memo, useState, useCallback } from "react"
import { ComposableMap, Geographies, Marker } from "react-simple-maps"
import { motion, AnimatePresence } from "framer-motion"
import { geoMercator } from "d3-geo"

import dottedMapData from "@/app/labs/watchdogs/data/dotted-map-data.json"
import {
  regionMarkers,
  getCountryColor,
  getCategoryColor,
} from "@/app/labs/watchdogs/data/watchdogs-data"
import { useWatchdogs } from "@/lib/watchdogs/provider"
import { CATEGORY_COLORS, MAP_CONFIG, formatRelativeTime } from "@/lib/watchdogs/config"
import type { EventCategory, ClassifiedEvent, RegionMarker } from "@/lib/watchdogs/types"

// Static pixel component (memoized for performance)
const StaticPixel = memo(({ x, y }: { x: number; y: number }) => (
  <rect
    x={x}
    y={y}
    width={MAP_CONFIG.pixelSize}
    height={MAP_CONFIG.pixelSize}
    className="fill-[var(--ds-gray-400)]"
    fillOpacity={0.3}
  />
))
StaticPixel.displayName = "StaticPixel"

// Animated pixel component with pulsing effect
const AnimatedPixel = memo(
  ({
    x,
    y,
    color,
    canPulse,
    cityDistanceRank,
  }: {
    x: number
    y: number
    color: string
    canPulse: boolean
    cityDistanceRank: number
  }) => {
    const delay = useMemo(() => cityDistanceRank * 0.1, [cityDistanceRank])

    const animate = canPulse
      ? {
          scale: [1, 1.8, 1],
          opacity: [0.8, 1, 0.8],
        }
      : { scale: 1, opacity: 1 }

    const transition = canPulse
      ? {
          opacity: {
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
            repeatDelay: delay,
          },
          scale: {
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
            repeatDelay: delay,
          },
        }
      : { type: "spring" as const, stiffness: 260, damping: 20 }

    return (
      <motion.rect
        x={x}
        y={y}
        width={MAP_CONFIG.pixelSize}
        height={MAP_CONFIG.pixelSize}
        fill={color}
        animate={animate}
        transition={transition}
        style={{
          willChange: canPulse && cityDistanceRank < 10 ? "transform, opacity" : undefined,
        }}
      />
    )
  }
)
AnimatedPixel.displayName = "AnimatedPixel"

// Event marker component (triangle for events)
const EventMarker = memo(
  ({
    event,
    delay,
    onHover,
    isSelected,
    onClick,
  }: {
    event: ClassifiedEvent
    delay: number
    onHover: (event: ClassifiedEvent | null) => void
    isSelected: boolean
    onClick: () => void
  }) => {
    if (!event.location) return null

    const color = CATEGORY_COLORS[event.category]
    const isCritical = event.severity === "critical"

    return (
      <Marker coordinates={[event.location.lng, event.location.lat]}>
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isSelected ? 2 : 1.5,
            opacity: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay,
          }}
          onMouseEnter={() => onHover(event)}
          onMouseLeave={() => onHover(null)}
          onClick={onClick}
          style={{ cursor: "pointer", pointerEvents: "auto" }}
        >
          {/* Pulse ring for critical events */}
          {isCritical && (
            <motion.circle
              r={8}
              fill="none"
              stroke={color}
              strokeWidth={1}
              animate={{
                r: [8, 16, 8],
                opacity: [0.8, 0, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          )}
          {/* Triangle marker */}
          <polygon
            points="0,-4 -3,2 3,2"
            fill={color}
            stroke="var(--ds-background-100)"
            strokeWidth={1}
            strokeOpacity={0.5}
            style={{ paintOrder: "stroke" }}
          />
          {/* Glow effect */}
          <motion.circle
            r={3}
            fill={color}
            fillOpacity={0.3}
            animate={
              isCritical
                ? { r: [3, 6, 3], opacity: [0.3, 0.1, 0.3] }
                : {}
            }
            transition={
              isCritical
                ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                : {}
            }
          />
        </motion.g>
      </Marker>
    )
  }
)
EventMarker.displayName = "EventMarker"

// Region marker component (small triangle for static regions)
const RegionMarkerComponent = memo(
  ({
    marker,
    delay,
    onHover,
  }: {
    marker: RegionMarker
    delay: number
    onHover: (marker: RegionMarker | null) => void
  }) => {
    const color = marker.category ? CATEGORY_COLORS[marker.category] : "var(--ds-gray-1000)"

    return (
      <Marker coordinates={marker.coordinates}>
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 0.6 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay,
          }}
          onMouseEnter={() => onHover(marker)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: "pointer", pointerEvents: "auto" }}
        >
          <polygon
            points="0,-2 -1.5,1 1.5,1"
            fill={color}
            stroke="var(--ds-background-100)"
            strokeWidth={0.5}
            strokeOpacity={0.3}
          />
        </motion.g>
      </Marker>
    )
  }
)
RegionMarkerComponent.displayName = "RegionMarkerComponent"

// Tooltip component
function MapTooltip({
  event,
  marker,
  projection,
  width,
  height,
}: {
  event: ClassifiedEvent | null
  marker: RegionMarker | null
  projection: d3.GeoProjection
  width: number
  height: number
}) {
  const item = event || marker
  if (!item) return null

  const coordinates = event?.location
    ? [event.location.lng, event.location.lat]
    : marker?.coordinates

  if (!coordinates) return null

  const coords = projection(coordinates as [number, number])
  if (!coords) return null

  const isEvent = !!event

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.15 }}
      className="absolute pointer-events-none z-10 bg-[var(--ds-background-200)] border border-[var(--ds-gray-200)] rounded-lg px-3 py-2 text-xs font-mono shadow-lg max-w-[280px]"
      style={{
        left: `${(coords[0] / width) * 100}%`,
        top: `${(coords[1] / height) * 100}%`,
        transform: "translate(-50%, -140%)",
      }}
    >
      {isEvent && event ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
            />
            <span
              className="uppercase text-[10px] font-medium"
              style={{ color: CATEGORY_COLORS[event.category] }}
            >
              {event.category}
            </span>
            <span className="text-[var(--ds-gray-500)]">·</span>
            <span className="text-[var(--ds-gray-500)]">
              {formatRelativeTime(event.classifiedAt)}
            </span>
          </div>
          <p className="text-[var(--ds-gray-1000)] font-medium line-clamp-2">
            {event.summary || event.rawArticle.title}
          </p>
          {event.location && (
            <p className="text-[var(--ds-gray-500)]">{event.location.name}</p>
          )}
        </div>
      ) : marker ? (
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px]"
            style={{ color: marker.category ? CATEGORY_COLORS[marker.category] : "var(--ds-gray-1000)" }}
          >
            ▲
          </span>
          <span className="text-[var(--ds-gray-1000)] font-medium">{marker.id}</span>
          <span className="text-[var(--ds-gray-500)]">·</span>
          <span className="text-[var(--ds-gray-900)]">{marker.name}</span>
        </div>
      ) : null}
    </motion.div>
  )
}

// Main DottedMap component
interface DottedMapProps {
  width?: number
  height?: number
}

export default function DottedMap({
  width = MAP_CONFIG.width,
  height = MAP_CONFIG.height,
}: DottedMapProps) {
  const { events, selectedEventId, selectEvent, filters } = useWatchdogs()
  const [hoveredEvent, setHoveredEvent] = useState<ClassifiedEvent | null>(null)
  const [hoveredMarker, setHoveredMarker] = useState<RegionMarker | null>(null)

  // Projection setup
  const projection = useMemo(
    () =>
      geoMercator()
        .scale(MAP_CONFIG.projection.scale)
        .center(MAP_CONFIG.projection.center)
        .rotate(MAP_CONFIG.projection.rotate)
        .translate([width / 2, height / 2]),
    [width, height]
  )

  // Filter events with locations for map display
  const mapEvents = useMemo(
    () =>
      events
        .filter((e) => e.location && filters.categories.has(e.category))
        .slice(0, 50), // Limit for performance
    [events, filters.categories]
  )

  // Get active countries based on events
  const activeCountries = useMemo(() => {
    const countries = new Map<string, { count: number; category: EventCategory }>()
    for (const event of mapEvents) {
      if (event.location?.countryCode && event.location.countryCode !== "XX") {
        const current = countries.get(event.location.countryCode)
        if (current) {
          current.count++
        } else {
          countries.set(event.location.countryCode, {
            count: 1,
            category: event.category,
          })
        }
      }
    }
    return countries
  }, [mapEvents])

  // Calculate pixels from map data
  const { staticPixels, animatedPixels } = useMemo(() => {
    const staticArr: Array<{ key: string; x: number; y: number }> = []
    const animatedArr: Array<{
      key: string
      x: number
      y: number
      color: string
      canPulse: boolean
      cityDistanceRank: number
    }> = []

    // Get top countries by event count
    const topCountries = new Set(
      Array.from(activeCountries.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([code]) => code)
    )

    Object.entries(
      dottedMapData as Record<string, Array<{ lon: number; lat: number; cityDistanceRank: number }>>
    ).forEach(([countryCode, cities]) => {
      const countryData = activeCountries.get(countryCode)
      const hasEvents = !!countryData
      const dotsToShow = hasEvents ? Math.min(countryData.count * 5, 35) : 2
      const color = hasEvents
        ? getCategoryColor(countryData.category)
        : getCountryColor(countryCode)
      const isTop = topCountries.has(countryCode)

      cities.forEach((city) => {
        const coords = projection([city.lon, city.lat])
        if (!coords) return

        const [x, y] = coords
        if (x < 0 || x > width || y < 0 || y > height) return

        const key = `${countryCode}-${city.cityDistanceRank}`
        const isAnimated = hasEvents && city.cityDistanceRank < dotsToShow

        if (isAnimated) {
          animatedArr.push({
            key,
            x,
            y,
            color,
            canPulse: isTop && city.cityDistanceRank < 5,
            cityDistanceRank: city.cityDistanceRank,
          })
        } else {
          staticArr.push({ key, x, y })
        }
      })
    })

    return { staticPixels: staticArr, animatedPixels: animatedArr }
  }, [projection, width, height, activeCountries])

  // Event marker delays (staggered animation)
  const eventDelays = useMemo(
    () => mapEvents.map((_, i) => (i * 0.05) % 1),
    [mapEvents]
  )

  // Region marker delays
  const regionDelays = useMemo(
    () => regionMarkers.map((_, i) => (i * 0.03) % 0.5),
    []
  )

  // Handle event click
  const handleEventClick = useCallback(
    (eventId: string) => {
      selectEvent(selectedEventId === eventId ? null : eventId)
    },
    [selectedEventId, selectEvent]
  )

  return (
    <div className="relative w-full bg-[var(--ds-background-100)]">
      {/* SVG with pixels */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        {/* Static pixels */}
        <g>
          {staticPixels.map((p) => (
            <StaticPixel key={p.key} x={p.x} y={p.y} />
          ))}
        </g>

        {/* Animated pixels */}
        <g>
          {animatedPixels.map((p) => (
            <AnimatedPixel
              key={p.key}
              x={p.x}
              y={p.y}
              color={p.color}
              canPulse={p.canPulse}
              cityDistanceRank={p.cityDistanceRank}
            />
          ))}
        </g>
      </svg>

      {/* Overlay with markers */}
      <div className="absolute inset-0 pointer-events-none">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: MAP_CONFIG.projection.scale,
            center: MAP_CONFIG.projection.center,
            rotate: MAP_CONFIG.projection.rotate,
          }}
          width={width}
          height={height}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
            {() => null}
          </Geographies>

          {/* Region markers */}
          {regionMarkers.map((marker, index) => (
            <RegionMarkerComponent
              key={marker.id}
              marker={marker}
              delay={regionDelays[index]}
              onHover={setHoveredMarker}
            />
          ))}

          {/* Event markers */}
          {mapEvents.map((event, index) => (
            <EventMarker
              key={event.id}
              event={event}
              delay={eventDelays[index]}
              onHover={setHoveredEvent}
              isSelected={selectedEventId === event.id}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </ComposableMap>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {(hoveredEvent || hoveredMarker) && (
          <MapTooltip
            event={hoveredEvent}
            marker={hoveredMarker}
            projection={projection}
            width={width}
            height={height}
          />
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-[var(--ds-background-100)]/80 backdrop-blur-sm border border-[var(--ds-gray-200)] rounded px-3 py-2">
        <div className="flex items-center gap-4 text-[10px] font-mono">
          {(Object.entries(CATEGORY_COLORS) as [EventCategory, string][]).map(
            ([category, color]) => (
              <div key={category} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[var(--ds-gray-500)] uppercase">{category}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
