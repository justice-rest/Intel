/**
 * Memory Timeline API Route
 * Returns memory creation timeline data for chart visualization
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMemoryEnabled } from "@/lib/memory"

export interface TimelineDataPoint {
  date: string
  auto: number
  explicit: number
}

/**
 * GET /api/memories/timeline
 * Get memory creation timeline (last 30 days by default)
 */
export async function GET(req: Request) {
  try {
    if (!isMemoryEnabled()) {
      return NextResponse.json(
        { success: false, error: "Memory system is disabled" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get("days") || "30")

    // Calculate start date
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    // Query memories created within the date range
    const { data: memories, error } = await supabase
      .from("user_memories")
      .select("created_at, memory_type")
      .eq("user_id", user.id)
      .gte("created_at", startDateStr)
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    // Process data into timeline format
    const timeline = processTimelineData(memories || [], days)

    return NextResponse.json({
      success: true,
      timeline,
      days,
    })
  } catch (error) {
    console.error("GET /api/memories/timeline error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch timeline",
      },
      { status: 500 }
    )
  }
}

/**
 * Process raw memory data into timeline format
 */
function processTimelineData(
  memories: Array<{ created_at: string; memory_type: string }>,
  days: number
): TimelineDataPoint[] {
  // Create map of dates to counts
  const dateMap = new Map<string, { auto: number; explicit: number }>()

  // Initialize all dates with zeros
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]
    dateMap.set(dateStr, { auto: 0, explicit: 0 })
  }

  // Count memories by date and type
  for (const memory of memories) {
    const dateStr = memory.created_at.split("T")[0]
    const existing = dateMap.get(dateStr)
    if (existing) {
      if (memory.memory_type === "auto") {
        existing.auto++
      } else if (memory.memory_type === "explicit") {
        existing.explicit++
      }
    }
  }

  // Convert to array format
  const timeline: TimelineDataPoint[] = []
  for (const [date, counts] of dateMap.entries()) {
    timeline.push({
      date,
      auto: counts.auto,
      explicit: counts.explicit,
    })
  }

  return timeline.sort((a, b) => a.date.localeCompare(b.date))
}
