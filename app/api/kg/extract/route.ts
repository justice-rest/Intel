/**
 * Knowledge Graph Extraction API Route
 *
 * Extracts entities and relationships from text using AI.
 * Use cases:
 * - Process donor research notes
 * - Extract entities from prospect profiles
 * - Build knowledge graph from documents
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMemoryEnabled, getKGManager, extractFromText } from "@/lib/memory"
import type { KGEntity, KGRelation, KGEntityType } from "@/lib/memory/types"

// Type aliases for API consistency
type EntityType = KGEntityType
type RelationType = string

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ExtractRequest {
  /** Text to extract entities from */
  text: string
  /** Optional context to improve extraction */
  context?: string
  /** Whether to save extracted entities to database */
  persist?: boolean
  /** Source memory ID for provenance */
  sourceMemoryId?: string
  /** Specific entity types to focus on */
  focusTypes?: EntityType[]
}

interface ExtractedEntity {
  name: string
  type: EntityType
  confidence: number
  aliases?: string[]
  metadata?: Record<string, unknown>
  /** Database ID if persisted */
  id?: string
}

interface ExtractedRelation {
  sourceEntity: string
  targetEntity: string
  relationType: RelationType
  confidence: number
  evidence?: string
  metadata?: Record<string, unknown>
}

interface ExtractResponse {
  success: boolean
  entities: ExtractedEntity[]
  relations: ExtractedRelation[]
  stats: {
    entitiesFound: number
    relationsFound: number
    persisted: boolean
    entitiesPersisted?: number
    relationsPersisted?: number
  }
  timing: {
    totalMs: number
    extractionMs: number
    persistMs?: number
  }
}

// ============================================================================
// POST - Extract Entities and Relations
// ============================================================================

export async function POST(req: Request): Promise<NextResponse<ExtractResponse | { success: false; error: string }>> {
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

    // Check API key
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "AI service not configured" },
        { status: 503 }
      )
    }

    const body = (await req.json()) as ExtractRequest

    // Validate required fields
    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Text is required for extraction" },
        { status: 400 }
      )
    }

    // Limit text length to prevent abuse
    const maxTextLength = 50000
    if (body.text.length > maxTextLength) {
      return NextResponse.json(
        { success: false, error: `Text exceeds maximum length of ${maxTextLength} characters` },
        { status: 400 }
      )
    }

    // Use KnowledgeGraphManager for extraction
    const kgManager = getKGManager(supabase as any)

    const extractionStart = Date.now()
    const extractedEntities: ExtractedEntity[] = []
    const extractedRelations: ExtractedRelation[] = []

    try {
      // Extract entities and relations using AI
      const extractionResult = await extractFromText(body.text)

      // Format entities
      for (const entity of extractionResult.entities) {
        extractedEntities.push({
          name: entity.name,
          type: entity.type,
          confidence: 0.8, // extractFromText doesn't return confidence
          aliases: entity.aliases,
          metadata: entity.description ? { description: entity.description } : undefined,
        })
      }

      // Format relations
      for (const relation of extractionResult.relations) {
        extractedRelations.push({
          sourceEntity: relation.source,
          targetEntity: relation.target,
          relationType: relation.relationType,
          confidence: 0.7, // extractFromText doesn't return confidence
          evidence: relation.description,
          metadata: undefined,
        })
      }
    } catch (extractError) {
      console.error("[kg/extract] Extraction failed:", extractError)
      return NextResponse.json(
        { success: false, error: "Entity extraction failed" },
        { status: 500 }
      )
    }

    const extractionMs = Date.now() - extractionStart

    // Optionally persist to database
    let persistMs: number | undefined
    let entitiesPersisted = 0
    let relationsPersisted = 0

    if (body.persist) {
      const persistStart = Date.now()

      try {
        // Create entity ID map for relation creation
        const entityIdMap = new Map<string, string>()

        // Persist entities
        for (const entity of extractedEntities) {
          const savedEntity = await kgManager.upsertEntity(user.id, {
            name: entity.name,
            type: entity.type,
            aliases: entity.aliases,
            description: entity.metadata?.description as string | undefined,
          })
          if (savedEntity) {
            entityIdMap.set(entity.name.toLowerCase(), savedEntity.id)
            entity.id = savedEntity.id
            entitiesPersisted++
          }
        }

        // Persist relations
        for (const relation of extractedRelations) {
          const sourceId = entityIdMap.get(relation.sourceEntity.toLowerCase())
          const targetId = entityIdMap.get(relation.targetEntity.toLowerCase())

          if (sourceId && targetId) {
            const savedRelation = await kgManager.createRelation({
              source_entity_id: sourceId,
              target_entity_id: targetId,
              relation_type: relation.relationType,
              source_memory_id: body.sourceMemoryId,
              metadata: {
                confidence: relation.confidence,
                evidence: relation.evidence,
              },
            })
            if (savedRelation) {
              relationsPersisted++
            }
          }
        }

        persistMs = Date.now() - persistStart
      } catch (persistError) {
        console.error("[kg/extract] Persist failed:", persistError)
        // Don't fail the whole request, just note that persist failed
      }
    }

    return NextResponse.json({
      success: true,
      entities: extractedEntities,
      relations: extractedRelations,
      stats: {
        entitiesFound: extractedEntities.length,
        relationsFound: extractedRelations.length,
        persisted: body.persist === true,
        entitiesPersisted: body.persist ? entitiesPersisted : undefined,
        relationsPersisted: body.persist ? relationsPersisted : undefined,
      },
      timing: {
        totalMs: Date.now() - startTime,
        extractionMs,
        persistMs,
      },
    })
  } catch (error) {
    console.error("POST /api/kg/extract error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract entities",
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Process Text and Update Graph
// ============================================================================

/**
 * PUT /api/kg/extract
 * Process text, extract entities, and intelligently merge with existing graph
 */
export async function PUT(req: Request): Promise<NextResponse> {
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

    const body = (await req.json()) as ExtractRequest & { merge?: boolean }

    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Text is required" },
        { status: 400 }
      )
    }

    // Use KnowledgeGraphManager
    const kgManager = getKGManager(supabase as any)

    // Process and merge with existing graph
    const result = await kgManager.processText(user.id, body.text, body.sourceMemoryId)

    return NextResponse.json({
      success: true,
      processed: true,
      entitiesCreated: result.entities.length,
      entitiesUpdated: 0, // processText doesn't track updates separately
      relationsCreated: result.relations.length,
      timing: {
        totalMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error("PUT /api/kg/extract error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process text",
      },
      { status: 500 }
    )
  }
}
