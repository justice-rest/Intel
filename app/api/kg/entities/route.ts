/**
 * Knowledge Graph Entities API Route
 *
 * CRUD operations for knowledge graph entities.
 * Entities represent people, organizations, and foundations
 * discovered through donor research.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMemoryEnabled, getKGManager } from "@/lib/memory"
import type { KGEntity, KGEntityType } from "@/lib/memory/types"

// Type alias for backward compatibility
type EntityType = KGEntityType

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ListEntitiesRequest {
  /** Filter by entity type */
  type?: EntityType
  /** Search by name */
  search?: string
  /** Maximum results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Include relations count */
  includeRelationsCount?: boolean
}

interface CreateEntityRequest {
  /** Entity name */
  name: string
  /** Entity type */
  type: EntityType
  /** Optional alternative names */
  aliases?: string[]
  /** Optional metadata */
  metadata?: Record<string, unknown>
  /** Source memory ID */
  sourceMemoryId?: string
}

interface EntityResponse {
  id: string
  canonical_name: string
  entity_type: EntityType
  aliases: string[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  relations_count?: number
}

// ============================================================================
// GET - List Entities
// ============================================================================

export async function GET(req: Request): Promise<NextResponse> {
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
        { success: false, error: "Database not configured" },
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
    const type = searchParams.get("type") as EntityType | null
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const includeRelationsCount = searchParams.get("includeRelationsCount") === "true"

    // Build query
    let query = supabase
      .from("kg_entities")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq("entity_type", type)
    }

    if (search) {
      query = query.or(`canonical_name.ilike.%${search}%,aliases.cs.{${search}}`)
    }

    const { data: entities, error, count } = await query

    if (error) {
      console.error("[kg/entities] Query error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch entities" },
        { status: 500 }
      )
    }

    // Format response
    const formattedEntities: EntityResponse[] = (entities || []).map((e) => ({
      id: e.id,
      canonical_name: e.canonical_name,
      entity_type: e.entity_type,
      aliases: e.aliases || [],
      metadata: (e.metadata ?? undefined) as Record<string, unknown> | undefined,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }))

    // Optionally include relations count
    if (includeRelationsCount && formattedEntities.length > 0) {
      const entityIds = formattedEntities.map((e) => e.id)
      const { data: relationCounts } = await supabase
        .from("kg_relations")
        .select("source_entity_id")
        .in("source_entity_id", entityIds)

      const countMap = new Map<string, number>()
      for (const rel of relationCounts || []) {
        const current = countMap.get(rel.source_entity_id) || 0
        countMap.set(rel.source_entity_id, current + 1)
      }

      for (const entity of formattedEntities) {
        entity.relations_count = countMap.get(entity.id) || 0
      }
    }

    return NextResponse.json({
      success: true,
      entities: formattedEntities,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error("GET /api/kg/entities error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch entities",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create Entity
// ============================================================================

export async function POST(req: Request): Promise<NextResponse> {
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
        { success: false, error: "Database not configured" },
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

    const body = (await req.json()) as CreateEntityRequest

    // Validate required fields
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Entity name is required" },
        { status: 400 }
      )
    }

    if (!body.type || !["person", "organization", "foundation"].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: "Valid entity type is required (person, organization, foundation)" },
        { status: 400 }
      )
    }

    // Use KnowledgeGraphManager to create entity (handles deduplication)
    const kgManager = getKGManager(supabase)
    const entity = await kgManager.upsertEntity(user.id, {
      name: body.name,
      type: body.type,
      aliases: body.aliases,
      description: body.metadata?.description as string | undefined,
    })

    if (!entity) {
      return NextResponse.json(
        { success: false, error: "Failed to create entity" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        entity: {
          id: entity.id,
          canonical_name: entity.canonical_name,
          entity_type: entity.entity_type,
          aliases: entity.aliases || [],
          metadata: entity.metadata,
          created_at: entity.created_at,
          updated_at: entity.updated_at,
        },
        message: "Entity created successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/kg/entities error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create entity",
      },
      { status: 500 }
    )
  }
}
