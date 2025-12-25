/**
 * Knowledge Graph Traversal API Route
 *
 * Multi-hop graph traversal for discovering entity relationships.
 * Use cases:
 * - Find all organizations connected to a person
 * - Discover board member networks
 * - Map foundation connections
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMemoryEnabled, getKGManager } from "@/lib/memory"
import type { KGEntity, KGRelation } from "@/lib/memory/types"

// Relation types used in traversal
type RelationType = string

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface TraverseRequest {
  /** Starting entity ID */
  startEntityId: string
  /** Maximum traversal depth */
  maxDepth?: number
  /** Filter by relation types */
  relationTypes?: RelationType[]
  /** Filter by entity types */
  entityTypes?: string[]
  /** Maximum nodes to return */
  limit?: number
  /** Include relation details */
  includeRelations?: boolean
}

interface TraversalNode {
  id: string
  canonical_name: string
  entity_type: string
  depth: number
  path: string[]
  metadata?: Record<string, unknown>
}

interface TraversalRelation {
  source_id: string
  target_id: string
  relation_type: RelationType
  metadata?: Record<string, unknown>
  valid_from?: string
  valid_until?: string
}

interface TraverseResponse {
  success: boolean
  startEntity: {
    id: string
    canonical_name: string
    entity_type: string
  }
  nodes: TraversalNode[]
  relations?: TraversalRelation[]
  stats: {
    totalNodes: number
    maxDepthReached: number
    nodesByType: Record<string, number>
    nodesByDepth: Record<number, number>
  }
  timing: {
    totalMs: number
  }
}

// ============================================================================
// POST - Traverse Graph
// ============================================================================

export async function POST(req: Request): Promise<NextResponse<TraverseResponse | { success: false; error: string }>> {
  const startTime = Date.now()

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

    const body = (await req.json()) as TraverseRequest

    // Validate required fields
    if (!body.startEntityId) {
      return NextResponse.json(
        { success: false, error: "startEntityId is required" },
        { status: 400 }
      )
    }

    const maxDepth = Math.min(body.maxDepth || 2, 5) // Cap at 5 for performance
    const limit = Math.min(body.limit || 50, 200) // Cap at 200

    // Verify start entity exists and belongs to user
    const { data: startEntity, error: startError } = await supabase
      .from("kg_entities")
      .select("*")
      .eq("id", body.startEntityId)
      .eq("user_id", user.id)
      .single()

    if (startError || !startEntity) {
      return NextResponse.json(
        { success: false, error: "Start entity not found" },
        { status: 404 }
      )
    }

    // Use KnowledgeGraphManager for traversal
    const kgManager = getKGManager(supabase)
    const traversalResult = await kgManager.traverse(body.startEntityId, {
      maxDepth,
      relationTypes: body.relationTypes,
      direction: "both",
    })

    // Filter by entity types if specified
    let filteredNodes = traversalResult
    if (body.entityTypes && body.entityTypes.length > 0) {
      filteredNodes = filteredNodes.filter((node) =>
        body.entityTypes!.includes(node.entity_type)
      )
    }

    // Apply limit
    filteredNodes = filteredNodes.slice(0, limit)

    // Format nodes
    const formattedNodes: TraversalNode[] = filteredNodes.map((node) => ({
      id: node.entity_id,
      canonical_name: node.entity_name,
      entity_type: node.entity_type,
      depth: node.depth,
      path: node.relation_path,
      metadata: undefined, // Add if needed
    }))

    // Calculate stats
    const nodesByType: Record<string, number> = {}
    const nodesByDepth: Record<number, number> = {}
    let maxDepthReached = 0

    for (const node of formattedNodes) {
      nodesByType[node.entity_type] = (nodesByType[node.entity_type] || 0) + 1
      nodesByDepth[node.depth] = (nodesByDepth[node.depth] || 0) + 1
      if (node.depth > maxDepthReached) {
        maxDepthReached = node.depth
      }
    }

    // Optionally include relations
    let relations: TraversalRelation[] | undefined
    if (body.includeRelations && formattedNodes.length > 0) {
      const nodeIds = formattedNodes.map((n) => n.id)
      // kg_relations doesn't have user_id - security is via entity ownership
      const { data: relationsData } = await supabase
        .from("kg_relations")
        .select("*")
        .or(`source_entity_id.in.(${nodeIds.join(",")}),target_entity_id.in.(${nodeIds.join(",")})`)

      relations = (relationsData || []).map((r: Record<string, unknown>) => ({
        source_id: r.source_entity_id as string,
        target_id: r.target_entity_id as string,
        relation_type: r.relation_type as RelationType,
        metadata: r.metadata as Record<string, unknown> | undefined,
        valid_from: r.valid_from as string | undefined,
        valid_until: r.valid_until as string | undefined,
      }))
    }

    return NextResponse.json({
      success: true,
      startEntity: {
        id: startEntity.id,
        canonical_name: startEntity.canonical_name,
        entity_type: startEntity.entity_type,
      },
      nodes: formattedNodes,
      relations,
      stats: {
        totalNodes: formattedNodes.length,
        maxDepthReached,
        nodesByType,
        nodesByDepth,
      },
      timing: {
        totalMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error("POST /api/kg/traverse error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to traverse graph",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Find Path Between Entities
// ============================================================================

export async function GET(req: Request): Promise<NextResponse> {
  const startTime = Date.now()

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
    const fromId = searchParams.get("from")
    const toId = searchParams.get("to")
    const maxDepth = parseInt(searchParams.get("maxDepth") || "4")

    if (!fromId || !toId) {
      return NextResponse.json(
        { success: false, error: "Both 'from' and 'to' entity IDs are required" },
        { status: 400 }
      )
    }

    // Verify both entities exist and belong to user
    const { data: entities, error: entitiesError } = await supabase
      .from("kg_entities")
      .select("*")
      .in("id", [fromId, toId])
      .eq("user_id", user.id)

    if (entitiesError || !entities || entities.length !== 2) {
      return NextResponse.json(
        { success: false, error: "One or both entities not found" },
        { status: 404 }
      )
    }

    // Use KnowledgeGraphManager to find path
    const kgManager = getKGManager(supabase)
    const path = await kgManager.findPath(fromId, toId, Math.min(maxDepth, 6))

    if (!path || path.length === 0) {
      return NextResponse.json({
        success: true,
        pathFound: false,
        path: [],
        message: `No path found between entities within ${maxDepth} hops`,
        timing: {
          totalMs: Date.now() - startTime,
        },
      })
    }

    // Fetch entity details for path
    const pathEntityIds = path.map((p) => p.entity_id)
    const { data: pathEntities } = await supabase
      .from("kg_entities")
      .select("*")
      .in("id", pathEntityIds)

    const entityMap = new Map(pathEntities?.map((e: { id: string; canonical_name: string; entity_type: string }) => [e.id, e]) || [])

    const formattedPath = path.map((p) => {
      const entity = entityMap.get(p.entity_id)
      return {
        entityId: p.entity_id,
        entityName: entity?.canonical_name || p.entity_name || "Unknown",
        entityType: entity?.entity_type || p.entity_type || "unknown",
        relation: p.relation_path.length > 0 ? p.relation_path[p.relation_path.length - 1] : null,
        depth: p.depth,
      }
    })

    return NextResponse.json({
      success: true,
      pathFound: true,
      path: formattedPath,
      pathLength: path.length,
      from: entities.find((e) => e.id === fromId),
      to: entities.find((e) => e.id === toId),
      timing: {
        totalMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error("GET /api/kg/traverse error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to find path",
      },
      { status: 500 }
    )
  }
}
