/**
 * Knowledge Graph API Index Route
 *
 * Provides overview and statistics for the user's knowledge graph.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMemoryEnabled } from "@/lib/memory"

// ============================================================================
// GET - Knowledge Graph Statistics
// ============================================================================

/**
 * GET /api/kg
 * Get overview statistics for user's knowledge graph
 */
export async function GET(): Promise<NextResponse> {
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

    // Get entity counts by type
    const { data: entities, error: entitiesError } = await supabase
      .from("kg_entities")
      .select("entity_type")
      .eq("user_id", user.id)

    if (entitiesError) {
      console.error("[kg] Entities query error:", entitiesError)
    }

    // Get relation counts by type
    const { data: relations, error: relationsError } = await supabase
      .from("kg_relations")
      .select("relation_type")
      .eq("user_id", user.id)

    if (relationsError) {
      console.error("[kg] Relations query error:", relationsError)
    }

    // Calculate stats
    const entitiesByType: Record<string, number> = {}
    for (const entity of entities || []) {
      entitiesByType[entity.entity_type] = (entitiesByType[entity.entity_type] || 0) + 1
    }

    const relationsByType: Record<string, number> = {}
    for (const relation of relations || []) {
      relationsByType[relation.relation_type] = (relationsByType[relation.relation_type] || 0) + 1
    }

    const totalEntities = entities?.length || 0
    const totalRelations = relations?.length || 0

    // Calculate graph density (relations per entity)
    const density = totalEntities > 0 ? totalRelations / totalEntities : 0

    return NextResponse.json({
      success: true,
      stats: {
        totalEntities,
        totalRelations,
        entitiesByType,
        relationsByType,
        density: Math.round(density * 100) / 100,
        health: calculateGraphHealth(totalEntities, totalRelations, entitiesByType),
      },
      endpoints: {
        entities: "/api/kg/entities",
        traverse: "/api/kg/traverse",
        extract: "/api/kg/extract",
      },
    })
  } catch (error) {
    console.error("GET /api/kg error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get KG stats",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Clear Knowledge Graph
// ============================================================================

/**
 * DELETE /api/kg
 * Clear all entities and relations for user (dangerous!)
 */
export async function DELETE(req: Request): Promise<NextResponse> {
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

    // Parse confirmation from body
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== "DELETE_ALL_KG_DATA") {
      return NextResponse.json(
        {
          success: false,
          error: "Confirmation required. Send { confirm: 'DELETE_ALL_KG_DATA' } to proceed.",
        },
        { status: 400 }
      )
    }

    // Delete relations first (foreign key constraint)
    const { error: relationsError } = await supabase
      .from("kg_relations")
      .delete()
      .eq("user_id", user.id)

    if (relationsError) {
      console.error("[kg] Delete relations error:", relationsError)
      return NextResponse.json(
        { success: false, error: "Failed to delete relations" },
        { status: 500 }
      )
    }

    // Delete entities
    const { error: entitiesError } = await supabase
      .from("kg_entities")
      .delete()
      .eq("user_id", user.id)

    if (entitiesError) {
      console.error("[kg] Delete entities error:", entitiesError)
      return NextResponse.json(
        { success: false, error: "Failed to delete entities" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Knowledge graph cleared successfully",
    })
  } catch (error) {
    console.error("DELETE /api/kg error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear KG",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate a health score for the knowledge graph
 */
function calculateGraphHealth(
  totalEntities: number,
  totalRelations: number,
  entitiesByType: Record<string, number>
): {
  score: number
  status: "empty" | "sparse" | "growing" | "healthy" | "rich"
  suggestions: string[]
} {
  const suggestions: string[] = []

  // Empty graph
  if (totalEntities === 0) {
    return {
      score: 0,
      status: "empty",
      suggestions: [
        "Start by adding some entities (people, organizations, foundations)",
        "Use the /api/kg/extract endpoint to extract entities from text",
      ],
    }
  }

  let score = 0

  // Entity count score (max 30 points)
  if (totalEntities >= 100) score += 30
  else if (totalEntities >= 50) score += 25
  else if (totalEntities >= 20) score += 20
  else if (totalEntities >= 10) score += 15
  else if (totalEntities >= 5) score += 10
  else score += 5

  // Relations score (max 30 points)
  const relationsPerEntity = totalRelations / totalEntities
  if (relationsPerEntity >= 3) score += 30
  else if (relationsPerEntity >= 2) score += 25
  else if (relationsPerEntity >= 1) score += 20
  else if (relationsPerEntity >= 0.5) score += 10
  else score += 5

  // Entity diversity score (max 20 points)
  const typesPresent = Object.keys(entitiesByType).length
  if (typesPresent >= 3) score += 20
  else if (typesPresent >= 2) score += 15
  else score += 10

  // Balance score (max 20 points)
  const hasPersons = (entitiesByType["person"] || 0) > 0
  const hasOrgs = (entitiesByType["organization"] || 0) > 0
  const hasFoundations = (entitiesByType["foundation"] || 0) > 0

  if (hasPersons && hasOrgs && hasFoundations) score += 20
  else if ((hasPersons && hasOrgs) || (hasPersons && hasFoundations)) score += 15
  else score += 10

  // Generate suggestions
  if (relationsPerEntity < 1) {
    suggestions.push("Add more relationships between entities for richer insights")
  }
  if (!hasPersons) {
    suggestions.push("Add person entities (donors, board members)")
  }
  if (!hasOrgs) {
    suggestions.push("Add organization entities (companies, nonprofits)")
  }
  if (!hasFoundations) {
    suggestions.push("Add foundation entities for philanthropy tracking")
  }

  // Determine status
  let status: "sparse" | "growing" | "healthy" | "rich"
  if (score < 30) status = "sparse"
  else if (score < 50) status = "growing"
  else if (score < 75) status = "healthy"
  else status = "rich"

  return { score, status, suggestions }
}
