import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ClassifiedEvent, EventCategory, EventSeverity } from "@/lib/watchdogs/types"

export const maxDuration = 30

// Database row type
interface WatchdogsEventRow {
  id: string
  user_id: string
  article_id: string
  article_title: string
  article_description: string | null
  article_url: string | null
  article_source: string | null
  article_published_at: string | null
  article_symbols: string[] | null
  category: EventCategory
  severity: EventSeverity
  summary: string
  impact_prediction: string | null
  entities: string[] | null
  location_name: string | null
  location_country_code: string | null
  location_lat: number | null
  location_lng: number | null
  classified_at: string
  classified_by: "grok" | "keywords" | null
  alert_generated: boolean
  dismissed: boolean
  created_at: string
  updated_at: string
}

// Convert database row to ClassifiedEvent
function rowToEvent(row: WatchdogsEventRow): ClassifiedEvent {
  return {
    id: row.article_id,
    rawArticle: {
      id: row.article_id,
      title: row.article_title,
      description: row.article_description || "",
      url: row.article_url || "",
      source: row.article_source || "Unknown",
      publishedAt: row.article_published_at || row.classified_at,
      symbols: row.article_symbols || undefined,
    },
    category: row.category,
    severity: row.severity,
    summary: row.summary,
    impactPrediction: row.impact_prediction || "",
    entities: row.entities || [],
    location: row.location_name ? {
      name: row.location_name,
      countryCode: row.location_country_code || "",
      lat: row.location_lat || 0,
      lng: row.location_lng || 0,
      type: "city" as const,
    } : undefined,
    classifiedAt: row.classified_at,
    alertGenerated: row.alert_generated,
    dismissed: row.dismissed,
    classifiedBy: row.classified_by || undefined,
  }
}

// Convert ClassifiedEvent to database row
function eventToRow(event: ClassifiedEvent, userId: string): Omit<WatchdogsEventRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    article_id: event.id,
    article_title: event.rawArticle.title,
    article_description: event.rawArticle.description || null,
    article_url: event.rawArticle.url || null,
    article_source: event.rawArticle.source || null,
    article_published_at: event.rawArticle.publishedAt || null,
    article_symbols: event.rawArticle.symbols || null,
    category: event.category,
    severity: event.severity,
    summary: event.summary,
    impact_prediction: event.impactPrediction || null,
    entities: event.entities || null,
    location_name: event.location?.name || null,
    location_country_code: event.location?.countryCode || null,
    location_lat: event.location?.lat || null,
    location_lng: event.location?.lng || null,
    classified_at: event.classifiedAt,
    classified_by: event.classifiedBy || null,
    alert_generated: event.alertGenerated,
    dismissed: event.dismissed,
  }
}

/**
 * GET /api/watchdogs/events
 * Fetch user's persisted events
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500)
    const category = searchParams.get("category") as EventCategory | null
    const severity = searchParams.get("severity") as EventSeverity | null
    const since = searchParams.get("since") // ISO timestamp

    // Build query
    let query = supabase
      .from("watchdogs_events")
      .select("*")
      .eq("user_id", user.id)
      .order("classified_at", { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq("category", category)
    }

    if (severity) {
      query = query.eq("severity", severity)
    }

    if (since) {
      query = query.gte("classified_at", since)
    }

    const { data, error } = await query

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01") {
        console.warn("[Watchdogs Events] Table does not exist yet, returning empty")
        return NextResponse.json({ events: [], needsMigration: true })
      }
      throw error
    }

    const events = (data as WatchdogsEventRow[] || []).map(rowToEvent)

    return NextResponse.json({ events })
  } catch (error) {
    console.error("[Watchdogs Events API] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/watchdogs/events
 * Save new events
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const events: ClassifiedEvent[] = body.events

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Invalid request: events array required" },
        { status: 400 }
      )
    }

    // Convert to database rows
    const rows = events.map((event) => eventToRow(event, user.id))

    // Upsert to handle duplicates
    // Using type assertion since watchdogs_events table may not be in generated types yet
    const { data, error } = await (supabase as any)
      .from("watchdogs_events")
      .upsert(rows, {
        onConflict: "user_id,article_id",
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01") {
        console.warn("[Watchdogs Events] Table does not exist yet")
        return NextResponse.json({ saved: 0, needsMigration: true })
      }
      throw error
    }

    return NextResponse.json({
      saved: data?.length || 0,
    })
  } catch (error) {
    console.error("[Watchdogs Events API] POST error:", error)
    return NextResponse.json(
      { error: "Failed to save events" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/watchdogs/events
 * Update event (dismiss alert, etc.)
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { articleId, dismissed } = body

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId required" },
        { status: 400 }
      )
    }

    // Using type assertion since watchdogs_events table may not be in generated types yet
    const { error } = await (supabase as any)
      .from("watchdogs_events")
      .update({ dismissed: dismissed ?? true })
      .eq("user_id", user.id)
      .eq("article_id", articleId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Watchdogs Events API] PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/watchdogs/events
 * Clear user's events (or specific event)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get("articleId")

    let query = supabase
      .from("watchdogs_events")
      .delete()
      .eq("user_id", user.id)

    if (articleId) {
      query = query.eq("article_id", articleId)
    }

    const { error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Watchdogs Events API] DELETE error:", error)
    return NextResponse.json(
      { error: "Failed to delete events" },
      { status: 500 }
    )
  }
}
