/**
 * Memory Manager - Lifecycle Management & Consolidation
 *
 * Handles the complete memory lifecycle:
 * - Creation with duplicate detection
 * - Versioning (updates create new versions)
 * - Consolidation (merge similar memories)
 * - Forgetting (TTL and manual)
 * - Tier promotion/demotion
 * - Importance decay
 *
 * Inspired by Supermemory's memory versioning and forgetting patterns.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type {
  UserMemoryV2,
  CreateMemoryV2,
  UpdateMemoryV2,
  MemoryTier,
  MemoryKind,
  ConsolidationCandidate,
  ConsolidationResult,
  ConsolidationOptions,
  DecayConfig,
  TierCriteria,
  MemoryStatsV2,
} from "./types"
import { generateEmbedding } from "./embedding-cache"
import { getHotCache } from "./hot-cache"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  dailyDecayRate: 0.01, // 1% per day
  minImportance: 0.1,
  accessBoost: 0.05,
  maxImportance: 1.0,
}

const DEFAULT_TIER_CRITERIA: TierCriteria = {
  hotVelocityThreshold: 0.5,
  coldVelocityThreshold: 0.1,
  coldInactiveDays: 30,
  hotMinImportance: 0.5,
}

const DEFAULT_CONSOLIDATION_OPTIONS: ConsolidationOptions = {
  similarityThreshold: 0.85,
  maxBatchSize: 100,
  dryRun: false,
}

// ============================================================================
// MEMORY MANAGER CLASS
// ============================================================================

export class MemoryManager {
  private supabase: SupabaseClient
  private decayConfig: DecayConfig
  private tierCriteria: TierCriteria

  constructor(
    supabase: SupabaseClient,
    decayConfig?: Partial<DecayConfig>,
    tierCriteria?: Partial<TierCriteria>
  ) {
    this.supabase = supabase
    this.decayConfig = { ...DEFAULT_DECAY_CONFIG, ...decayConfig }
    this.tierCriteria = { ...DEFAULT_TIER_CRITERIA, ...tierCriteria }
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new memory with duplicate detection
   * If similar memory exists, creates a new version instead
   */
  async createMemory(input: CreateMemoryV2): Promise<UserMemoryV2> {
    // Generate embedding if not provided
    const embedding = input.embedding || (await generateEmbedding(input.content))

    // Check for duplicates
    const duplicate = await this.findDuplicate(
      input.user_id,
      embedding,
      0.9 // High threshold for exact duplicates
    )

    if (duplicate) {
      // Create new version of existing memory
      return this.createVersion(duplicate, input)
    }

    // Determine initial tier
    const tier = input.memory_tier || this.determineInitialTier(input)

    // Insert new memory
    const { data, error } = await this.supabase
      .from("user_memories")
      .insert({
        user_id: input.user_id,
        content: input.content,
        memory_tier: tier,
        memory_kind: input.memory_kind || "episodic",
        memory_type: input.memory_type || "auto",
        is_static: input.is_static || false,
        is_inference: input.is_inference || false,
        importance_score: input.importance_score || 0.5,
        source_chat_id: input.source_chat_id || null,
        source_message_id: input.source_message_id || null,
        event_timestamp: input.event_timestamp || null,
        valid_until: input.valid_until || null,
        forget_after: input.forget_after || null,
        embedding,
        embedding_model: input.embedding_model || "text-embedding-3-small",
        matryoshka_embedding: input.matryoshka_embedding || null,
        metadata: input.metadata || {},
        tags: input.tags || [],
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create memory: ${error.message}`)
    }

    // Update hot cache if applicable
    if (tier === "hot") {
      const hotCache = getHotCache()
      hotCache.addMemory(input.user_id, data as UserMemoryV2)
    }

    return data as UserMemoryV2
  }

  /**
   * Create a new version of an existing memory
   * Implements Supermemory's versioning pattern
   */
  async createVersion(
    existing: UserMemoryV2,
    update: CreateMemoryV2
  ): Promise<UserMemoryV2> {
    // Mark existing as not latest
    await this.supabase
      .from("user_memories")
      .update({ is_latest: false })
      .eq("id", existing.id)

    // Create new version
    const embedding =
      update.embedding || (await generateEmbedding(update.content))

    const { data, error } = await this.supabase
      .from("user_memories")
      .insert({
        user_id: existing.user_id,
        content: update.content,
        memory_tier: existing.memory_tier,
        memory_kind: existing.memory_kind,
        memory_type: update.memory_type || existing.memory_type,
        is_static: update.is_static ?? existing.is_static,
        is_inference: update.is_inference ?? existing.is_inference,
        version: existing.version + 1,
        is_latest: true,
        parent_memory_id: existing.id,
        root_memory_id: existing.root_memory_id || existing.id,
        importance_score:
          update.importance_score ||
          Math.min(
            this.decayConfig.maxImportance,
            existing.importance_score + 0.1
          ),
        source_count: existing.source_count + 1,
        source_chat_id: update.source_chat_id || existing.source_chat_id,
        source_message_id: update.source_message_id,
        embedding,
        embedding_model: update.embedding_model || existing.embedding_model,
        metadata: {
          ...(typeof existing.metadata === "object" && existing.metadata !== null
            ? existing.metadata
            : {}),
          ...update.metadata,
        },
        tags: [...new Set([...(existing.tags || []), ...(update.tags || [])])],
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create memory version: ${error.message}`)
    }

    // Add relation
    await this.supabase.from("memory_relations").insert({
      source_memory_id: data.id,
      target_memory_id: existing.id,
      relation_type: "updates",
      strength: 1.0,
    })

    // Invalidate hot cache
    const hotCache = getHotCache()
    hotCache.invalidate(existing.user_id)

    return data as UserMemoryV2
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    memoryId: string,
    update: UpdateMemoryV2
  ): Promise<UserMemoryV2> {
    // Get current memory
    const { data: current, error: fetchError } = await this.supabase
      .from("user_memories")
      .select("*")
      .eq("id", memoryId)
      .single()

    if (fetchError || !current) {
      throw new Error(`Memory not found: ${memoryId}`)
    }

    // If content changed, regenerate embedding
    let embedding = update.embedding
    if (update.content && update.content !== current.content && !embedding) {
      embedding = await generateEmbedding(update.content)
    }

    // Update memory
    const { data, error } = await this.supabase
      .from("user_memories")
      .update({
        ...update,
        embedding: embedding || current.embedding,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`)
    }

    // Update hot cache
    const hotCache = getHotCache()
    hotCache.updateMemory(current.user_id, data as UserMemoryV2)

    return data as UserMemoryV2
  }

  /**
   * Forget a memory (soft delete with reason)
   * Implements Supermemory's forgetting mechanism
   */
  async forgetMemory(
    memoryId: string,
    reason: string
  ): Promise<void> {
    const { data: current, error: fetchError } = await this.supabase
      .from("user_memories")
      .select("user_id")
      .eq("id", memoryId)
      .single()

    if (fetchError) {
      throw new Error(`Memory not found: ${memoryId}`)
    }

    const { error } = await this.supabase
      .from("user_memories")
      .update({
        is_forgotten: true,
        forget_reason: reason,
        memory_tier: "cold",
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryId)

    if (error) {
      throw new Error(`Failed to forget memory: ${error.message}`)
    }

    // Remove from hot cache
    const hotCache = getHotCache()
    hotCache.removeMemory(current.user_id, memoryId)
  }

  /**
   * Permanently delete a memory and its versions
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const { data: current, error: fetchError } = await this.supabase
      .from("user_memories")
      .select("user_id, root_memory_id")
      .eq("id", memoryId)
      .single()

    if (fetchError) {
      throw new Error(`Memory not found: ${memoryId}`)
    }

    // Delete all versions if this is the root
    const rootId = current.root_memory_id || memoryId

    // Validate UUID to prevent PostgREST filter injection
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rootId)) {
      throw new Error("Invalid memory ID")
    }

    // Delete relations first
    await this.supabase
      .from("memory_relations")
      .delete()
      .or(`source_memory_id.eq.${rootId},target_memory_id.eq.${rootId}`)

    // Delete all versions
    await this.supabase
      .from("user_memories")
      .delete()
      .or(`id.eq.${rootId},root_memory_id.eq.${rootId}`)

    // Invalidate hot cache
    const hotCache = getHotCache()
    hotCache.invalidate(current.user_id)
  }

  // ==========================================================================
  // CONSOLIDATION
  // ==========================================================================

  /**
   * Find and consolidate similar memories
   */
  async consolidateMemories(
    userId: string,
    options: ConsolidationOptions = DEFAULT_CONSOLIDATION_OPTIONS
  ): Promise<ConsolidationResult[]> {
    const { similarityThreshold, maxBatchSize, dryRun } = {
      ...DEFAULT_CONSOLIDATION_OPTIONS,
      ...options,
    }

    // Get user's active memories
    const { data: memories, error } = await this.supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .eq("is_forgotten", false)
      .eq("is_latest", true)
      .order("importance_score", { ascending: false })
      .limit(maxBatchSize!)

    if (error || !memories || memories.length < 2) {
      return []
    }

    // Find consolidation candidates
    const candidates = await this.findConsolidationCandidates(
      memories as UserMemoryV2[],
      similarityThreshold!
    )

    if (dryRun) {
      // Return candidates without merging
      return candidates.map((c: ConsolidationCandidate) => ({
        merged: c.memories[0],
        sourceIds: c.memories.map((m: UserMemoryV2) => m.id),
        similarity: c.similarity,
      }))
    }

    // Perform consolidation
    const results: ConsolidationResult[] = []
    for (const candidate of candidates) {
      const result = await this.mergeMemories(candidate)
      if (result) {
        results.push(result)
      }
    }

    // Invalidate hot cache
    if (results.length > 0) {
      const hotCache = getHotCache()
      hotCache.invalidate(userId)
    }

    return results
  }

  /**
   * Find pairs of memories that could be consolidated
   */
  private async findConsolidationCandidates(
    memories: UserMemoryV2[],
    threshold: number
  ): Promise<ConsolidationCandidate[]> {
    const candidates: ConsolidationCandidate[] = []
    const used = new Set<string>()

    for (let i = 0; i < memories.length; i++) {
      if (used.has(memories[i].id)) continue

      const similar: UserMemoryV2[] = [memories[i]]
      let maxSimilarity = 0

      for (let j = i + 1; j < memories.length; j++) {
        if (used.has(memories[j].id)) continue

        const similarity = this.calculateSimilarity(memories[i], memories[j])
        if (similarity >= threshold) {
          similar.push(memories[j])
          maxSimilarity = Math.max(maxSimilarity, similarity)
          used.add(memories[j].id)
        }
      }

      if (similar.length > 1) {
        used.add(memories[i].id)
        candidates.push({
          memories: similar,
          similarity: maxSimilarity,
          suggestedContent: this.mergeMemoContent(similar),
          suggestedImportance: Math.max(...similar.map((m) => m.importance_score)),
        })
      }
    }

    return candidates
  }

  /**
   * Calculate similarity between two memories
   */
  private calculateSimilarity(a: UserMemoryV2, b: UserMemoryV2): number {
    if (!a.embedding || !b.embedding) return 0

    // Parse embeddings if they are JSON strings
    let embeddingA: number[]
    let embeddingB: number[]

    if (Array.isArray(a.embedding)) {
      embeddingA = a.embedding
    } else if (typeof a.embedding === "string") {
      try {
        embeddingA = JSON.parse(a.embedding)
      } catch {
        return 0
      }
    } else {
      return 0
    }

    if (Array.isArray(b.embedding)) {
      embeddingB = b.embedding
    } else if (typeof b.embedding === "string") {
      try {
        embeddingB = JSON.parse(b.embedding)
      } catch {
        return 0
      }
    } else {
      return 0
    }

    // Cosine similarity
    let dot = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < embeddingA.length; i++) {
      dot += embeddingA[i] * embeddingB[i]
      normA += embeddingA[i] * embeddingA[i]
      normB += embeddingB[i] * embeddingB[i]
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Merge multiple memory contents into one
   */
  private mergeMemoContent(memories: UserMemoryV2[]): string {
    // For now, keep the longest/most important content
    // Could use LLM to intelligently merge in the future
    const sorted = [...memories].sort(
      (a, b) =>
        b.importance_score - a.importance_score ||
        b.content.length - a.content.length
    )
    return sorted[0].content
  }

  /**
   * Merge similar memories into one
   */
  private async mergeMemories(
    candidate: ConsolidationCandidate
  ): Promise<ConsolidationResult | null> {
    const [primary, ...others] = candidate.memories

    // Create merged memory
    const embedding = await generateEmbedding(candidate.suggestedContent)

    const { data: merged, error } = await this.supabase
      .from("user_memories")
      .insert({
        user_id: primary.user_id,
        content: candidate.suggestedContent,
        memory_tier: primary.memory_tier,
        memory_kind: primary.memory_kind,
        memory_type: primary.memory_type,
        is_static: primary.is_static,
        importance_score: candidate.suggestedImportance,
        source_count: candidate.memories.reduce(
          (sum: number, m: UserMemoryV2) => sum + m.source_count,
          0
        ),
        embedding,
        embedding_model: primary.embedding_model,
        metadata: {
          consolidated_from: candidate.memories.map((m: UserMemoryV2) => m.id),
          consolidation_similarity: candidate.similarity,
        },
        tags: [
          ...new Set(candidate.memories.flatMap((m: UserMemoryV2) => m.tags)),
        ],
      })
      .select()
      .single()

    if (error) {
      console.error("[memory-manager] Merge failed:", error)
      return null
    }

    // Mark source memories as not latest
    await this.supabase
      .from("user_memories")
      .update({ is_latest: false })
      .in(
        "id",
        candidate.memories.map((m: UserMemoryV2) => m.id)
      )

    // Create relations
    for (const source of candidate.memories) {
      await this.supabase.from("memory_relations").insert({
        source_memory_id: merged.id,
        target_memory_id: source.id,
        relation_type: "derives",
        strength: candidate.similarity,
      })
    }

    return {
      merged: merged as UserMemoryV2,
      sourceIds: candidate.memories.map((m: UserMemoryV2) => m.id),
      similarity: candidate.similarity,
    }
  }

  // ==========================================================================
  // TIER MANAGEMENT
  // ==========================================================================

  /**
   * Update memory tiers based on access patterns
   */
  async updateTiers(userId: string): Promise<{
    promotedToHot: number
    demotedToWarm: number
    demotedToCold: number
  }> {
    const stats = { promotedToHot: 0, demotedToWarm: 0, demotedToCold: 0 }

    // Get user's memories
    const { data: memories, error } = await this.supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .eq("is_forgotten", false)
      .eq("is_latest", true)

    if (error || !memories) return stats

    const updates: Array<{ id: string; tier: MemoryTier }> = []

    for (const memory of memories as UserMemoryV2[]) {
      const newTier = this.calculateNewTier(memory)
      if (newTier !== memory.memory_tier) {
        updates.push({ id: memory.id, tier: newTier })

        if (newTier === "hot") stats.promotedToHot++
        else if (newTier === "warm" && memory.memory_tier === "hot")
          stats.demotedToWarm++
        else if (newTier === "cold") stats.demotedToCold++
      }
    }

    // Apply updates in batches
    for (const update of updates) {
      await this.supabase
        .from("user_memories")
        .update({ memory_tier: update.tier, updated_at: new Date().toISOString() })
        .eq("id", update.id)
    }

    // Invalidate hot cache if changes made
    if (updates.length > 0) {
      const hotCache = getHotCache()
      hotCache.invalidate(userId)
    }

    return stats
  }

  /**
   * Calculate the appropriate tier for a memory
   */
  private calculateNewTier(memory: UserMemoryV2): MemoryTier {
    // Static memories always hot
    if (memory.is_static) return "hot"

    // Profile memories always hot
    if (memory.memory_kind === "profile") return "hot"

    // Check for cold tier (inactive)
    if (memory.last_accessed_at) {
      const daysSinceAccess =
        (Date.now() - new Date(memory.last_accessed_at).getTime()) /
        (1000 * 60 * 60 * 24)

      if (daysSinceAccess > this.tierCriteria.coldInactiveDays) {
        return "cold"
      }
    }

    // Check velocity for hot tier
    if (
      memory.access_velocity >= this.tierCriteria.hotVelocityThreshold &&
      memory.importance_score >= this.tierCriteria.hotMinImportance
    ) {
      return "hot"
    }

    // Check velocity for cold tier
    if (memory.access_velocity < this.tierCriteria.coldVelocityThreshold) {
      return "cold"
    }

    return "warm"
  }

  /**
   * Determine initial tier for new memory
   */
  private determineInitialTier(input: CreateMemoryV2): MemoryTier {
    // Static memories start hot
    if (input.is_static) return "hot"

    // Profile memories start hot
    if (input.memory_kind === "profile") return "hot"

    // High importance starts warm, otherwise cold initially
    if (input.importance_score && input.importance_score >= 0.7) {
      return "warm"
    }

    return "warm" // Default to warm
  }

  // ==========================================================================
  // DECAY & MAINTENANCE
  // ==========================================================================

  /**
   * Apply daily decay to importance scores
   */
  async applyDecay(userId: string): Promise<number> {
    // Use database function for efficiency
    const { data, error } = await this.supabase.rpc("apply_memory_decay", {
      target_user_id: userId,
      decay_rate: this.decayConfig.dailyDecayRate,
      min_importance: this.decayConfig.minImportance,
    })

    if (error) {
      console.error("[memory-manager] Decay failed:", error)
      return 0
    }

    // Invalidate hot cache
    const hotCache = getHotCache()
    hotCache.invalidate(userId)

    return data || 0
  }

  /**
   * Record memory access and boost importance
   */
  async recordAccess(memoryId: string): Promise<void> {
    const { error } = await this.supabase.rpc("increment_memory_access", {
      memory_id: memoryId,
      boost_amount: this.decayConfig.accessBoost,
      max_importance: this.decayConfig.maxImportance,
    })

    if (error) {
      console.error("[memory-manager] Access recording failed:", error)
    }
  }

  /**
   * Process expired memories (forget_after passed)
   */
  async processExpiredMemories(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("user_memories")
      .update({
        is_forgotten: true,
        forget_reason: "TTL expired",
        memory_tier: "cold",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_forgotten", false)
      .lte("forget_after", new Date().toISOString())
      .select("id")

    if (error) {
      console.error("[memory-manager] Expiration processing failed:", error)
      return 0
    }

    if (data && data.length > 0) {
      const hotCache = getHotCache()
      hotCache.invalidate(userId)
    }

    return data?.length || 0
  }

  // ==========================================================================
  // DUPLICATE DETECTION
  // ==========================================================================

  /**
   * Find duplicate memory by embedding similarity
   */
  private async findDuplicate(
    userId: string,
    embedding: number[],
    threshold: number
  ): Promise<UserMemoryV2 | null> {
    const { data, error } = await this.supabase.rpc("search_user_memories", {
      query_embedding: JSON.stringify(embedding),
      match_user_id: userId,
      match_count: 1,
      similarity_threshold: threshold,
      memory_type_filter: null,
      min_importance: 0,
    })

    if (error || !data || data.length === 0) {
      return null
    }

    const top = data[0]
    // Fetch full memory from V1 table
    const { data: memory } = await this.supabase
      .from("user_memories")
      .select("*")
      .eq("id", top.id)
      .single()

    return memory as UserMemoryV2 | null
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get memory statistics for a user
   */
  async getStats(userId: string): Promise<MemoryStatsV2> {
    const { data, error } = await this.supabase.rpc(
      "get_user_memory_stats",
      { user_id_param: userId }
    )

    if (error) {
      console.error("[memory-manager] Stats fetch failed:", error)
      // Return empty stats
      return {
        total_memories: 0,
        hot_memories: 0,
        warm_memories: 0,
        cold_memories: 0,
        episodic_count: 0,
        semantic_count: 0,
        procedural_count: 0,
        profile_count: 0,
        auto_count: 0,
        explicit_count: 0,
        inference_count: 0,
        static_count: 0,
        avg_importance: 0,
        avg_access_velocity: 0,
        most_recent_memory: null,
        oldest_memory: null,
        forgotten_count: 0,
        expiring_soon_count: 0,
      }
    }

    return data as MemoryStatsV2
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryManagerInstance: MemoryManager | null = null

/**
 * Get the memory manager instance
 */
export function getMemoryManager(
  supabase: SupabaseClient,
  config?: {
    decayConfig?: Partial<DecayConfig>
    tierCriteria?: Partial<TierCriteria>
  }
): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(
      supabase,
      config?.decayConfig,
      config?.tierCriteria
    )
  }
  return memoryManagerInstance
}
