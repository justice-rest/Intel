/**
 * Data Provenance Manager
 *
 * Tracks the origin and history of every data field extracted during research.
 * Provides full audit trail for compliance and debugging.
 *
 * Features:
 * - Field-level provenance tracking
 * - Source attribution with URLs
 * - Extraction method logging
 * - Confidence levels
 * - Historical versioning
 */

import { createClient } from "@/lib/supabase/server"
import type { ConfidenceLevel } from "../triangulation/confidence-scorer"
import { identifySource, type SourceCategory } from "../triangulation/source-registry"

// ============================================================================
// TYPES
// ============================================================================

export interface ProvenanceRecord {
  id: string
  itemId: string
  fieldPath: string
  value: unknown
  confidence: ConfidenceLevel
  sources: Array<{
    name: string
    url: string
    authority: number
    category: SourceCategory
  }>
  extractionMethod: string
  modelUsed?: string
  tokensUsed?: number
  extractedAt: Date
  supersededBy?: string
  supersededAt?: Date
}

export interface ProvenanceInput {
  itemId: string
  fieldPath: string
  value: unknown
  confidence: ConfidenceLevel
  sources: Array<{
    name: string
    url: string
  }>
  extractionMethod: string
  modelUsed?: string
  tokensUsed?: number
}

export interface AuditReport {
  itemId: string
  generatedAt: Date
  totalFields: number
  fieldsByConfidence: Record<ConfidenceLevel, number>
  sourceBreakdown: Array<{
    source: string
    fieldsProvided: number
    authority: number
  }>
  fieldHistory: Array<{
    fieldPath: string
    currentValue: unknown
    confidence: ConfidenceLevel
    source: string
    versions: number
  }>
}

export interface IProvenanceManager {
  /**
   * Record provenance for a field extraction
   */
  record(input: ProvenanceInput): Promise<string>

  /**
   * Record multiple fields at once
   */
  recordBatch(inputs: ProvenanceInput[]): Promise<void>

  /**
   * Get current provenance for a field
   */
  getFieldProvenance(itemId: string, fieldPath: string): Promise<ProvenanceRecord | null>

  /**
   * Get provenance history for a field (including superseded values)
   */
  getFieldHistory(itemId: string, fieldPath: string): Promise<ProvenanceRecord[]>

  /**
   * Get all provenance records for an item
   */
  getAllForItem(itemId: string): Promise<ProvenanceRecord[]>

  /**
   * Generate audit report for an item
   */
  generateAuditReport(itemId: string): Promise<AuditReport>

  /**
   * Supersede a field with new value (updates provenance chain)
   */
  supersede(itemId: string, fieldPath: string, newInput: ProvenanceInput): Promise<string>
}

// ============================================================================
// DATABASE IMPLEMENTATION
// ============================================================================

export class DatabaseProvenanceManager implements IProvenanceManager {
  private tableName = "prospect_data_provenance"

  async record(input: ProvenanceInput): Promise<string> {
    const supabase = await createClient()
    if (!supabase) {
      console.warn("[Provenance] No Supabase client, skipping provenance record")
      return ""
    }

    // Enrich sources with authority and category
    const enrichedSources = input.sources.map((s) => {
      const source = identifySource(s.url)
      return {
        name: s.name || source?.name || "Unknown",
        url: s.url,
        authority: source?.authority ?? 0.5,
        category: source?.category ?? "llm_synthesis",
      }
    })

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .insert({
        item_id: input.itemId,
        field_path: input.fieldPath,
        value_json: input.value,
        confidence: input.confidence,
        sources: enrichedSources,
        extraction_method: input.extractionMethod,
        model_used: input.modelUsed,
        tokens_used: input.tokensUsed,
        extracted_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (error) {
      console.error("[Provenance] Failed to record:", error)
      return ""
    }

    return data.id
  }

  async recordBatch(inputs: ProvenanceInput[]): Promise<void> {
    if (inputs.length === 0) return

    const supabase = await createClient()
    if (!supabase) return

    const records = inputs.map((input) => ({
      item_id: input.itemId,
      field_path: input.fieldPath,
      value_json: input.value,
      confidence: input.confidence,
      sources: input.sources.map((s) => {
        const source = identifySource(s.url)
        return {
          name: s.name || source?.name || "Unknown",
          url: s.url,
          authority: source?.authority ?? 0.5,
          category: source?.category ?? "llm_synthesis",
        }
      }),
      extraction_method: input.extractionMethod,
      model_used: input.modelUsed,
      tokens_used: input.tokensUsed,
      extracted_at: new Date().toISOString(),
    }))

    const { error } = await (supabase as any).from(this.tableName).insert(records)

    if (error) {
      console.error("[Provenance] Failed to record batch:", error)
    }
  }

  async getFieldProvenance(itemId: string, fieldPath: string): Promise<ProvenanceRecord | null> {
    const supabase = await createClient()
    if (!supabase) return null

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("item_id", itemId)
      .eq("field_path", fieldPath)
      .is("superseded_by", null)
      .order("extracted_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return this.mapToRecord(data)
  }

  async getFieldHistory(itemId: string, fieldPath: string): Promise<ProvenanceRecord[]> {
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("item_id", itemId)
      .eq("field_path", fieldPath)
      .order("extracted_at", { ascending: false })

    if (error || !data) return []

    return data.map(this.mapToRecord)
  }

  async getAllForItem(itemId: string): Promise<ProvenanceRecord[]> {
    const supabase = await createClient()
    if (!supabase) return []

    const { data, error } = await (supabase as any)
      .from(this.tableName)
      .select("*")
      .eq("item_id", itemId)
      .is("superseded_by", null)
      .order("field_path")

    if (error || !data) return []

    return data.map(this.mapToRecord)
  }

  async generateAuditReport(itemId: string): Promise<AuditReport> {
    const records = await this.getAllForItem(itemId)

    const fieldsByConfidence: Record<ConfidenceLevel, number> = {
      VERIFIED: 0,
      CORROBORATED: 0,
      SINGLE_SOURCE: 0,
      ESTIMATED: 0,
      CONFLICTED: 0,
    }

    const sourceMap = new Map<string, { fieldsProvided: number; authority: number }>()

    const fieldHistory: AuditReport["fieldHistory"] = []

    for (const record of records) {
      // Count by confidence
      fieldsByConfidence[record.confidence]++

      // Track source contributions
      for (const source of record.sources) {
        const existing = sourceMap.get(source.name) || { fieldsProvided: 0, authority: source.authority }
        existing.fieldsProvided++
        sourceMap.set(source.name, existing)
      }

      // Get history count for this field
      const history = await this.getFieldHistory(itemId, record.fieldPath)

      fieldHistory.push({
        fieldPath: record.fieldPath,
        currentValue: record.value,
        confidence: record.confidence,
        source: record.sources[0]?.name || "Unknown",
        versions: history.length,
      })
    }

    return {
      itemId,
      generatedAt: new Date(),
      totalFields: records.length,
      fieldsByConfidence,
      sourceBreakdown: Array.from(sourceMap.entries())
        .map(([source, data]) => ({
          source,
          fieldsProvided: data.fieldsProvided,
          authority: data.authority,
        }))
        .sort((a, b) => b.fieldsProvided - a.fieldsProvided),
      fieldHistory,
    }
  }

  async supersede(itemId: string, fieldPath: string, newInput: ProvenanceInput): Promise<string> {
    const supabase = await createClient()
    if (!supabase) return ""

    // Find current record
    const current = await this.getFieldProvenance(itemId, fieldPath)

    // Record new value
    const newId = await this.record(newInput)

    // Mark old record as superseded
    if (current) {
      await (supabase as any)
        .from(this.tableName)
        .update({
          superseded_by: newId,
          superseded_at: new Date().toISOString(),
        })
        .eq("id", current.id)
    }

    return newId
  }

  private mapToRecord(data: Record<string, unknown>): ProvenanceRecord {
    return {
      id: data.id as string,
      itemId: data.item_id as string,
      fieldPath: data.field_path as string,
      value: data.value_json,
      confidence: data.confidence as ConfidenceLevel,
      sources: (data.sources as ProvenanceRecord["sources"]) || [],
      extractionMethod: data.extraction_method as string,
      modelUsed: data.model_used as string | undefined,
      tokensUsed: data.tokens_used as number | undefined,
      extractedAt: new Date(data.extracted_at as string),
      supersededBy: data.superseded_by as string | undefined,
      supersededAt: data.superseded_at ? new Date(data.superseded_at as string) : undefined,
    }
  }
}

// ============================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ============================================================================

export class InMemoryProvenanceManager implements IProvenanceManager {
  private records: Map<string, ProvenanceRecord> = new Map()
  private nextId = 1

  async record(input: ProvenanceInput): Promise<string> {
    const id = `prov-${this.nextId++}`

    const enrichedSources = input.sources.map((s) => {
      const source = identifySource(s.url)
      return {
        name: s.name || source?.name || "Unknown",
        url: s.url,
        authority: source?.authority ?? 0.5,
        category: (source?.category ?? "llm_synthesis") as SourceCategory,
      }
    })

    this.records.set(id, {
      id,
      itemId: input.itemId,
      fieldPath: input.fieldPath,
      value: input.value,
      confidence: input.confidence,
      sources: enrichedSources,
      extractionMethod: input.extractionMethod,
      modelUsed: input.modelUsed,
      tokensUsed: input.tokensUsed,
      extractedAt: new Date(),
    })

    return id
  }

  async recordBatch(inputs: ProvenanceInput[]): Promise<void> {
    for (const input of inputs) {
      await this.record(input)
    }
  }

  async getFieldProvenance(itemId: string, fieldPath: string): Promise<ProvenanceRecord | null> {
    for (const record of this.records.values()) {
      if (record.itemId === itemId && record.fieldPath === fieldPath && !record.supersededBy) {
        return record
      }
    }
    return null
  }

  async getFieldHistory(itemId: string, fieldPath: string): Promise<ProvenanceRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.itemId === itemId && r.fieldPath === fieldPath)
      .sort((a, b) => b.extractedAt.getTime() - a.extractedAt.getTime())
  }

  async getAllForItem(itemId: string): Promise<ProvenanceRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.itemId === itemId && !r.supersededBy)
      .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath))
  }

  async generateAuditReport(itemId: string): Promise<AuditReport> {
    const records = await this.getAllForItem(itemId)

    const fieldsByConfidence: Record<ConfidenceLevel, number> = {
      VERIFIED: 0,
      CORROBORATED: 0,
      SINGLE_SOURCE: 0,
      ESTIMATED: 0,
      CONFLICTED: 0,
    }

    const sourceMap = new Map<string, { fieldsProvided: number; authority: number }>()

    for (const record of records) {
      fieldsByConfidence[record.confidence]++

      for (const source of record.sources) {
        const existing = sourceMap.get(source.name) || { fieldsProvided: 0, authority: source.authority }
        existing.fieldsProvided++
        sourceMap.set(source.name, existing)
      }
    }

    return {
      itemId,
      generatedAt: new Date(),
      totalFields: records.length,
      fieldsByConfidence,
      sourceBreakdown: Array.from(sourceMap.entries())
        .map(([source, data]) => ({
          source,
          fieldsProvided: data.fieldsProvided,
          authority: data.authority,
        }))
        .sort((a, b) => b.fieldsProvided - a.fieldsProvided),
      fieldHistory: await Promise.all(
        records.map(async (record) => ({
          fieldPath: record.fieldPath,
          currentValue: record.value,
          confidence: record.confidence,
          source: record.sources[0]?.name || "Unknown",
          versions: (await this.getFieldHistory(itemId, record.fieldPath)).length,
        }))
      ),
    }
  }

  async supersede(itemId: string, fieldPath: string, newInput: ProvenanceInput): Promise<string> {
    const current = await this.getFieldProvenance(itemId, fieldPath)
    const newId = await this.record(newInput)

    if (current) {
      current.supersededBy = newId
      current.supersededAt = new Date()
    }

    return newId
  }

  // For testing
  clear(): void {
    this.records.clear()
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createProvenanceManager(): IProvenanceManager {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return new DatabaseProvenanceManager()
  }
  console.warn("[Provenance] No Supabase configured, using in-memory manager")
  return new InMemoryProvenanceManager()
}

export const provenanceManager = new DatabaseProvenanceManager()
