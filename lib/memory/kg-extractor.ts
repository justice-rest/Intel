// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

/**
 * Knowledge Graph Extractor - Entity & Relation Extraction
 *
 * Extracts entities and relationships from text for the knowledge graph.
 * Optimized for donor research use cases:
 * - Person names, roles, affiliations
 * - Organization names, types
 * - Foundation EINs, assets
 * - Relationships (works_at, board_member, donated_to, owns)
 *
 * Uses GPT-4o-mini for extraction (~$0.001 per extraction).
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type {
  KGEntity,
  KGRelation,
  CreateKGEntity,
  CreateKGRelation,
  KGEntityType,
  KGTraversalResult,
} from "./types"
import { generateEmbedding } from "./embedding-cache"

// ============================================================================
// CONFIGURATION
// ============================================================================

const KG_CONFIG = {
  extractionModel: "openai/gpt-4o-mini",
  maxTextLength: 8000,
  timeout: 30000,
  maxEntitiesPerExtraction: 20,
  maxRelationsPerExtraction: 30,
}

// Common relation types for donor research
const RELATION_TYPES = [
  "works_at",
  "board_member",
  "executive_at",
  "founder_of",
  "donated_to",
  "owns",
  "invested_in",
  "affiliated_with",
  "spouse_of",
  "child_of",
  "parent_of",
  "located_in",
  "subsidiary_of",
  "partner_of",
] as const

type RelationType = (typeof RELATION_TYPES)[number]

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

interface ExtractedEntity {
  name: string
  type: KGEntityType
  aliases?: string[]
  description?: string
}

interface ExtractedRelation {
  source: string
  target: string
  relationType: RelationType
  description?: string
}

interface ExtractionResult {
  entities: ExtractedEntity[]
  relations: ExtractedRelation[]
}

/**
 * Extract entities and relations from text using LLM
 */
export async function extractFromText(text: string): Promise<ExtractionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn("[kg-extractor] OPENROUTER_API_KEY not configured")
    return { entities: [], relations: [] }
  }

  // Truncate if too long
  const truncatedText =
    text.length > KG_CONFIG.maxTextLength
      ? text.substring(0, KG_CONFIG.maxTextLength) + "..."
      : text

  const prompt = `Extract entities and relationships from this text for a donor research knowledge graph.

Entity Types: person, organization, foundation, company, location, concept, event

Relation Types: ${RELATION_TYPES.join(", ")}

Text:
${truncatedText}

Return a JSON object with this exact structure:
{
  "entities": [
    {"name": "Full Name", "type": "person", "aliases": ["nickname"], "description": "brief description"}
  ],
  "relations": [
    {"source": "Entity Name 1", "target": "Entity Name 2", "relationType": "works_at", "description": "context"}
  ]
}

Focus on:
- People: names, roles, titles
- Organizations: companies, nonprofits, foundations
- Relationships: employment, board positions, donations, ownership

Return ONLY valid JSON, no explanations.`

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000",
        "X-Title": "Romy KG Extractor",
      },
      body: JSON.stringify({
        model: KG_CONFIG.extractionModel,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(KG_CONFIG.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Extraction failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn("[kg-extractor] No JSON found in response")
      return { entities: [], relations: [] }
    }

    const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult

    // Validate and limit results
    const entities = (parsed.entities || []).slice(
      0,
      KG_CONFIG.maxEntitiesPerExtraction
    )
    const relations = (parsed.relations || []).slice(
      0,
      KG_CONFIG.maxRelationsPerExtraction
    )

    return { entities, relations }
  } catch (error) {
    console.error("[kg-extractor] Extraction error:", error)
    return { entities: [], relations: [] }
  }
}

// ============================================================================
// KNOWLEDGE GRAPH STORAGE
// ============================================================================

export class KnowledgeGraphManager {
  private supabase: AnySupabaseClient

  constructor(supabase: AnySupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Process text and add extracted entities/relations to the graph
   */
  async processText(
    userId: string,
    text: string,
    sourceMemoryId?: string
  ): Promise<{
    entities: KGEntity[]
    relations: KGRelation[]
  }> {
    // Extract from text
    const extracted = await extractFromText(text)

    if (extracted.entities.length === 0) {
      return { entities: [], relations: [] }
    }

    // Store entities (with deduplication)
    const storedEntities: KGEntity[] = []
    const entityMap = new Map<string, string>() // name -> id

    for (const entity of extracted.entities) {
      const stored = await this.upsertEntity(userId, entity)
      if (stored) {
        storedEntities.push(stored)
        entityMap.set(entity.name.toLowerCase(), stored.id)
        // Also map aliases
        for (const alias of entity.aliases || []) {
          entityMap.set(alias.toLowerCase(), stored.id)
        }
      }
    }

    // Store relations
    const storedRelations: KGRelation[] = []

    for (const relation of extracted.relations) {
      const sourceId = entityMap.get(relation.source.toLowerCase())
      const targetId = entityMap.get(relation.target.toLowerCase())

      if (sourceId && targetId) {
        const stored = await this.createRelation({
          source_entity_id: sourceId,
          target_entity_id: targetId,
          relation_type: relation.relationType,
          source_memory_id: sourceMemoryId,
          metadata: relation.description
            ? { description: relation.description }
            : undefined,
        })
        if (stored) {
          storedRelations.push(stored)
        }
      }
    }

    return { entities: storedEntities, relations: storedRelations }
  }

  /**
   * Create or update an entity (deduplicated by canonical name)
   */
  async upsertEntity(
    userId: string,
    entity: ExtractedEntity
  ): Promise<KGEntity | null> {
    const canonicalName = normalizeEntityName(entity.name)

    // Check for existing entity
    const { data: existing } = await this.supabase
      .from("kg_entities")
      .select("*")
      .eq("user_id", userId)
      .eq("canonical_name", canonicalName)
      .single()

    if (existing) {
      // Merge aliases
      const newAliases = [
        ...new Set([
          ...(existing.aliases || []),
          ...(entity.aliases || []),
          entity.name,
        ]),
      ].filter((a) => normalizeEntityName(a) !== canonicalName)

      // Update if new info
      if (
        entity.description &&
        entity.description !== existing.description
      ) {
        const { data: updated } = await this.supabase
          .from("kg_entities")
          .update({
            aliases: newAliases,
            description: entity.description || existing.description,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single()

        return updated as KGEntity
      }

      return existing as KGEntity
    }

    // Create new entity
    const embedding = await generateEmbedding(
      `${entity.name} ${entity.type} ${entity.description || ""}`
    )

    const { data: created, error } = await this.supabase
      .from("kg_entities")
      .insert({
        user_id: userId,
        entity_type: entity.type,
        canonical_name: canonicalName,
        display_name: entity.name,
        aliases: entity.aliases || [],
        description: entity.description || null,
        embedding,
        embedding_model: "text-embedding-3-small",
      })
      .select()
      .single()

    if (error) {
      console.error("[kg-extractor] Entity creation failed:", error)
      return null
    }

    return created as KGEntity
  }

  /**
   * Create a relation between entities
   */
  async createRelation(input: CreateKGRelation): Promise<KGRelation | null> {
    // Check for existing relation
    const { data: existing } = await this.supabase
      .from("kg_relations")
      .select("*")
      .eq("source_entity_id", input.source_entity_id)
      .eq("target_entity_id", input.target_entity_id)
      .eq("relation_type", input.relation_type)
      .single()

    if (existing) {
      // Update strength if we see it again (more confident)
      const { data: updated } = await this.supabase
        .from("kg_relations")
        .update({
          strength: Math.min(1.0, (existing.strength || 0.5) + 0.1),
        })
        .eq("id", existing.id)
        .select()
        .single()

      return updated as KGRelation
    }

    // Create new relation
    const { data: created, error } = await this.supabase
      .from("kg_relations")
      .insert({
        ...input,
        strength: input.strength || 0.5,
      })
      .select()
      .single()

    if (error) {
      console.error("[kg-extractor] Relation creation failed:", error)
      return null
    }

    return created as KGRelation
  }

  /**
   * Search entities by name
   */
  async searchEntities(
    userId: string,
    query: string,
    options: {
      limit?: number
      entityTypes?: KGEntityType[]
    } = {}
  ): Promise<KGEntity[]> {
    const { limit = 10, entityTypes } = options

    let queryBuilder = this.supabase
      .from("kg_entities")
      .select("*")
      .eq("user_id", userId)
      .ilike("canonical_name", `%${normalizeEntityName(query)}%`)

    if (entityTypes && entityTypes.length > 0) {
      queryBuilder = queryBuilder.in("entity_type", entityTypes)
    }

    const { data, error } = await queryBuilder.limit(limit)

    if (error) {
      console.error("[kg-extractor] Entity search failed:", error)
      return []
    }

    return (data || []) as KGEntity[]
  }

  /**
   * Get entity with its relations
   */
  async getEntityWithRelations(
    entityId: string
  ): Promise<{
    entity: KGEntity
    outgoing: Array<{ relation: KGRelation; target: KGEntity }>
    incoming: Array<{ relation: KGRelation; source: KGEntity }>
  } | null> {
    // Get entity
    const { data: entity, error: entityError } = await this.supabase
      .from("kg_entities")
      .select("*")
      .eq("id", entityId)
      .single()

    if (entityError || !entity) return null

    // Get outgoing relations
    const { data: outgoingRels } = await this.supabase
      .from("kg_relations")
      .select("*")
      .eq("source_entity_id", entityId)

    // Get incoming relations
    const { data: incomingRels } = await this.supabase
      .from("kg_relations")
      .select("*")
      .eq("target_entity_id", entityId)

    // Fetch target entities for outgoing relations
    const outgoingTargetIds = (outgoingRels || []).map((r: { target_entity_id: string }) => r.target_entity_id)
    const { data: outgoingTargets } = outgoingTargetIds.length > 0
      ? await this.supabase.from("kg_entities").select("*").in("id", outgoingTargetIds)
      : { data: [] }

    // Fetch source entities for incoming relations
    const incomingSourceIds = (incomingRels || []).map((r: { source_entity_id: string }) => r.source_entity_id)
    const { data: incomingSources } = incomingSourceIds.length > 0
      ? await this.supabase.from("kg_entities").select("*").in("id", incomingSourceIds)
      : { data: [] }

    const targetMap = new Map((outgoingTargets || []).map((e: KGEntity) => [e.id, e]))
    const sourceMap = new Map((incomingSources || []).map((e: KGEntity) => [e.id, e]))

    return {
      entity: entity as KGEntity,
      outgoing: (outgoingRels || []).map((r: Record<string, unknown>) => ({
        relation: r as unknown as KGRelation,
        target: targetMap.get(r.target_entity_id as string) as KGEntity,
      })),
      incoming: (incomingRels || []).map((r: Record<string, unknown>) => ({
        relation: r as unknown as KGRelation,
        source: sourceMap.get(r.source_entity_id as string) as KGEntity,
      })),
    }
  }

  /**
   * Traverse the knowledge graph from a starting entity
   */
  async traverse(
    startEntityId: string,
    options: {
      maxDepth?: number
      relationTypes?: string[]
      direction?: "outgoing" | "incoming" | "both"
    } = {}
  ): Promise<KGTraversalResult[]> {
    const { maxDepth = 2, relationTypes, direction = "both" } = options

    const { data, error } = await this.supabase.rpc("kg_traverse", {
      start_entity_id: startEntityId,
      max_depth: maxDepth,
      relation_types: relationTypes || null,
      traverse_direction: direction,
    })

    if (error) {
      console.error("[kg-extractor] Traversal failed:", error)
      return []
    }

    return (data || []) as KGTraversalResult[]
  }

  /**
   * Find connections between two entities
   */
  async findPath(
    startEntityId: string,
    endEntityId: string,
    maxDepth: number = 3
  ): Promise<KGTraversalResult[]> {
    // Get all reachable from start
    const fromStart = await this.traverse(startEntityId, { maxDepth })

    // Find path to end
    const path = fromStart.filter((r) => r.entity_id === endEntityId)

    return path
  }

  /**
   * Get entities related to a topic (semantic search)
   */
  async findRelatedEntities(
    userId: string,
    query: string,
    options: {
      limit?: number
      threshold?: number
    } = {}
  ): Promise<KGEntity[]> {
    const { limit = 10, threshold = 0.5 } = options

    const embedding = await generateEmbedding(query)

    const { data, error } = await this.supabase.rpc("search_kg_entities", {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: limit,
      match_threshold: threshold,
    })

    if (error) {
      console.error("[kg-extractor] Related entity search failed:", error)
      return []
    }

    return (data || []) as KGEntity[]
  }

  /**
   * Delete an entity and its relations
   */
  async deleteEntity(entityId: string): Promise<void> {
    // Delete relations first
    await this.supabase
      .from("kg_relations")
      .delete()
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)

    // Delete entity
    await this.supabase.from("kg_entities").delete().eq("id", entityId)
  }

  /**
   * Merge duplicate entities
   */
  async mergeEntities(
    primaryId: string,
    duplicateIds: string[]
  ): Promise<KGEntity | null> {
    // Get all entities
    const { data: entities } = await this.supabase
      .from("kg_entities")
      .select("*")
      .in("id", [primaryId, ...duplicateIds])

    if (!entities || entities.length < 2) return null

    const primary = entities.find((e: any) => e.id === primaryId) as KGEntity
    const duplicates = entities.filter((e: any) => e.id !== primaryId) as KGEntity[]

    // Merge aliases
    const allAliases = [
      ...new Set([
        ...(primary.aliases || []),
        ...duplicates.flatMap((d) => [d.display_name, ...(d.aliases || [])]),
      ]),
    ]

    // Update primary
    await this.supabase
      .from("kg_entities")
      .update({
        aliases: allAliases,
        updated_at: new Date().toISOString(),
      })
      .eq("id", primaryId)

    // Redirect relations
    for (const dupId of duplicateIds) {
      await this.supabase
        .from("kg_relations")
        .update({ source_entity_id: primaryId })
        .eq("source_entity_id", dupId)

      await this.supabase
        .from("kg_relations")
        .update({ target_entity_id: primaryId })
        .eq("target_entity_id", dupId)
    }

    // Delete duplicates
    await this.supabase.from("kg_entities").delete().in("id", duplicateIds)

    // Return updated primary
    const { data: updated } = await this.supabase
      .from("kg_entities")
      .select("*")
      .eq("id", primaryId)
      .single()

    return updated as KGEntity
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize entity name for deduplication
 */
function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
}

/**
 * Format entities for context injection
 */
export function formatEntitiesForContext(
  entities: KGEntity[],
  relations: KGRelation[]
): string {
  if (entities.length === 0) return ""

  const lines: string[] = ["## Known Entities"]

  // Group by type
  const byType = new Map<KGEntityType, KGEntity[]>()
  for (const entity of entities) {
    const list = byType.get(entity.entity_type) || []
    list.push(entity)
    byType.set(entity.entity_type, list)
  }

  for (const [type, typeEntities] of byType) {
    lines.push(`\n### ${type.charAt(0).toUpperCase() + type.slice(1)}s`)
    for (const entity of typeEntities) {
      let line = `- **${entity.display_name}**`
      if (entity.description) {
        line += `: ${entity.description}`
      }
      lines.push(line)
    }
  }

  if (relations.length > 0) {
    lines.push("\n### Relationships")
    for (const relation of relations.slice(0, 10)) {
      lines.push(`- ${relation.relation_type}`)
    }
  }

  return lines.join("\n")
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let kgManagerInstance: KnowledgeGraphManager | null = null

/**
 * Get the knowledge graph manager instance
 */
export function getKGManager(supabase: AnySupabaseClient): KnowledgeGraphManager {
  if (!kgManagerInstance) {
    kgManagerInstance = new KnowledgeGraphManager(supabase)
  }
  return kgManagerInstance
}
