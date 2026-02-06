/**
 * Knowledge Prompt Generator
 *
 * Generates personalized system prompt sections from organizational knowledge.
 * This is the core integration point that makes Rōmy embody an organization's
 * fundraising DNA.
 *
 * NOTE: Uses type assertions for knowledge tables because the migration
 * creates tables not yet in the generated Supabase types. After running
 * the migration and regenerating types, these assertions can be removed.
 */

import { createClient } from '@/lib/supabase/server'
import { TOKEN_BUDGET, estimateTokens } from './config'
import type {
  KnowledgeProfile,
  KnowledgeVoiceElement,
  KnowledgeStrategyRule,
  KnowledgeFact,
  KnowledgeExample,
  GeneratedKnowledgePrompt,
} from './types'

// Type helper for knowledge table queries (until types are regenerated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KnowledgeClient = any

// ============================================================================
// PROMPT GENERATION
// ============================================================================

/**
 * Get the active knowledge profile for a user and generate the prompt
 */
export async function getKnowledgePromptForUser(
  userId: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    // Get active global profile (exclude chat-scoped profiles)
    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .is('chat_scoped_to', null)
      .single()

    if (!profile) return null

    // Check if we have cached prompts that are still valid
    if (profile.voice_prompt || profile.strategy_prompt || profile.knowledge_prompt || profile.rules_prompt) {
      return combinePromptSections(profile)
    }

    // Generate fresh prompts
    const generated = await generateKnowledgePrompt(profile.id, userId)
    if (!generated) return null

    return formatGeneratedPrompt(generated)
  } catch (error) {
    console.error('getKnowledgePromptForUser error:', error)
    return null
  }
}

/**
 * Generate knowledge prompt from profile data
 */
export async function generateKnowledgePrompt(
  profileId: string,
  userId: string
): Promise<GeneratedKnowledgePrompt | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    // Get all active elements in parallel
    const [
      { data: voiceElements },
      { data: strategyRules },
      { data: facts },
      { data: examples },
    ] = await Promise.all([
      (supabase as KnowledgeClient)
        .from('knowledge_voice_elements')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('confidence', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_strategy_rules')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('priority', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_facts')
        .select('id, profile_id, category, fact, importance, is_user_defined, is_active, created_at')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('importance', { ascending: false }),
      (supabase as KnowledgeClient)
        .from('knowledge_examples')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ])

    // Generate each section
    const voicePrompt = generateVoiceSection(voiceElements || [])
    const strategyPrompt = generateStrategySection(strategyRules || [])
    const knowledgePrompt = generateKnowledgeSection(facts || [])
    const rulesPrompt = generateRulesSection(strategyRules || [])
    const examplesPrompt = generateExamplesSection(examples || [])

    const totalTokens =
      estimateTokens(voicePrompt) +
      estimateTokens(strategyPrompt) +
      estimateTokens(knowledgePrompt) +
      estimateTokens(rulesPrompt) +
      estimateTokens(examplesPrompt)

    // Get profile for version
    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('version')
      .eq('id', profileId)
      .single()

    const generated: GeneratedKnowledgePrompt = {
      voice: voicePrompt,
      strategy: strategyPrompt,
      knowledge: knowledgePrompt,
      rules: rulesPrompt,
      examples: examplesPrompt,
      total_tokens: totalTokens,
      generated_at: new Date().toISOString(),
      profile_version: profile?.version || 1,
    }

    // Update profile with generated prompts
    await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update({
        voice_prompt: voicePrompt || null,
        strategy_prompt: strategyPrompt || null,
        knowledge_prompt: knowledgePrompt || null,
        rules_prompt: rulesPrompt || null,
        prompt_generated_at: new Date().toISOString(),
        prompt_token_count: totalTokens,
      })
      .eq('id', profileId)

    // Create version snapshot
    await (supabase as KnowledgeClient).from('knowledge_profile_versions').insert({
      profile_id: profileId,
      version: (profile?.version || 0) + 1,
      voice_prompt: voicePrompt || null,
      strategy_prompt: strategyPrompt || null,
      knowledge_prompt: knowledgePrompt || null,
      rules_prompt: rulesPrompt || null,
      change_summary: 'Prompt regeneration',
      changed_by: 'auto',
    })

    // Increment version
    await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .update({ version: (profile?.version || 0) + 1 })
      .eq('id', profileId)

    return generated
  } catch (error) {
    console.error('generateKnowledgePrompt error:', error)
    return null
  }
}

/**
 * Get the knowledge prompt for a specific profile by ID.
 * Used to generate prompt text for chat-scoped profiles.
 */
export async function getKnowledgePromptForProfile(
  profileId: string
): Promise<string | null> {
  try {
    const supabase = await createClient()
    if (!supabase) return null

    const { data: profile } = await (supabase as KnowledgeClient)
      .from('knowledge_profiles')
      .select('*')
      .eq('id', profileId)
      .is('deleted_at', null)
      .single()

    if (!profile) return null

    // Use cached prompts if available
    if (profile.voice_prompt || profile.strategy_prompt || profile.knowledge_prompt || profile.rules_prompt) {
      return combinePromptSections(profile)
    }

    // Generate fresh prompts from elements
    const generated = await generateKnowledgePrompt(profileId, profile.user_id)
    if (!generated) return null

    return formatGeneratedPrompt(generated)
  } catch (error) {
    console.error('getKnowledgePromptForProfile error:', error)
    return null
  }
}

// ============================================================================
// SECTION GENERATORS
// ============================================================================

/**
 * Generate voice/style section
 */
function generateVoiceSection(elements: KnowledgeVoiceElement[]): string {
  if (elements.length === 0) return ''

  const sections: string[] = []

  // Group by type
  const byType = groupBy(elements, 'element_type')

  // Tone
  const toneElements = byType.tone || []
  if (toneElements.length > 0) {
    const tones = toneElements.map((e) => e.value).join(', ')
    sections.push(`**Tone**: ${tones}`)
  }

  // Formality
  const formalityElements = byType.formality || []
  if (formalityElements.length > 0) {
    sections.push(`**Formality**: ${formalityElements[0].value}`)
  }

  // Word preferences
  const wordPrefs = byType.word_preference || []
  const wordAvoid = byType.word_avoidance || []
  if (wordPrefs.length > 0 || wordAvoid.length > 0) {
    const prefLines: string[] = []
    wordPrefs.forEach((e) => {
      prefLines.push(`- Use "${e.value}"${e.description ? ` (${e.description})` : ''}`)
    })
    wordAvoid.forEach((e) => {
      prefLines.push(`- Avoid "${e.value}"${e.description ? ` - ${e.description}` : ''}`)
    })
    if (prefLines.length > 0) {
      sections.push(`**Terminology**:\n${prefLines.join('\n')}`)
    }
  }

  // Sentence style
  const sentenceStyle = byType.sentence_style || []
  if (sentenceStyle.length > 0) {
    sections.push(`**Writing Style**: ${sentenceStyle.map((e) => e.value).join('; ')}`)
  }

  // Emotional register
  const emotional = byType.emotional_register || []
  if (emotional.length > 0) {
    sections.push(`**Emotional Register**: ${emotional.map((e) => e.value).join(', ')}`)
  }

  if (sections.length === 0) return ''

  // Truncate if over budget
  let result = sections.join('\n\n')
  if (estimateTokens(result) > TOKEN_BUDGET.voice) {
    result = truncateToTokens(result, TOKEN_BUDGET.voice)
  }

  return result
}

/**
 * Generate strategy section
 */
function generateStrategySection(rules: KnowledgeStrategyRule[]): string {
  if (rules.length === 0) return ''

  // Group by category
  const byCategory = groupBy(rules, 'category')
  const sections: string[] = []

  // Define category order
  const categoryOrder = [
    'cultivation',
    'solicitation',
    'stewardship',
    'ask_philosophy',
    'communication',
    'general',
  ]

  for (const category of categoryOrder) {
    const categoryRules = byCategory[category] || []
    if (categoryRules.length === 0) continue

    // Get top rules by priority (max 3 per category for strategy section)
    const topRules = categoryRules.slice(0, 3)
    const formatted = topRules.map((r) => `- ${r.rule}`).join('\n')

    sections.push(`**${formatCategory(category)}**:\n${formatted}`)
  }

  if (sections.length === 0) return ''

  let result = sections.join('\n\n')
  if (estimateTokens(result) > TOKEN_BUDGET.strategy) {
    result = truncateToTokens(result, TOKEN_BUDGET.strategy)
  }

  return result
}

/**
 * Generate knowledge facts section
 */
function generateKnowledgeSection(facts: Omit<KnowledgeFact, 'embedding'>[]): string {
  if (facts.length === 0) return ''

  // Group by category
  const byCategory = groupBy(facts, 'category')
  const sections: string[] = []

  // Define category order
  const categoryOrder = [
    'mission',
    'organization',
    'programs',
    'impact',
    'campaigns',
    'staff',
    'board',
    'values',
    'history',
    'donors',
  ]

  for (const category of categoryOrder) {
    const categoryFacts = byCategory[category] || []
    if (categoryFacts.length === 0) continue

    // Get top facts by importance (max 5 per category)
    const topFacts = categoryFacts.slice(0, 5)
    const formatted = topFacts.map((f) => `- ${f.fact}`).join('\n')

    sections.push(`**${formatCategory(category)}**:\n${formatted}`)
  }

  if (sections.length === 0) return ''

  let result = sections.join('\n\n')
  if (estimateTokens(result) > TOKEN_BUDGET.knowledge) {
    result = truncateToTokens(result, TOKEN_BUDGET.knowledge)
  }

  return result
}

/**
 * Generate rules section (behavioral instructions)
 */
function generateRulesSection(rules: KnowledgeStrategyRule[]): string {
  if (rules.length === 0) return ''

  // Get highest priority rules across all categories
  const topRules = rules
    .filter((r) => r.priority >= 7) // Only high-priority rules
    .slice(0, 10)

  if (topRules.length === 0) return ''

  const formatted = topRules.map((r, i) => `${i + 1}. ${r.rule}`).join('\n')

  let result = `**Key Behavioral Rules**:\n${formatted}`
  if (estimateTokens(result) > TOKEN_BUDGET.rules) {
    result = truncateToTokens(result, TOKEN_BUDGET.rules)
  }

  return result
}

/**
 * Generate examples section for few-shot learning
 */
function generateExamplesSection(examples: KnowledgeExample[]): string {
  if (examples.length === 0) return ''

  // Get good examples (max 2)
  const goodExamples = examples
    .filter((e) => e.example_type === 'good')
    .slice(0, 2)

  // Get bad examples to avoid (max 1)
  const badExamples = examples
    .filter((e) => e.example_type === 'bad')
    .slice(0, 1)

  const sections: string[] = []

  if (goodExamples.length > 0) {
    const formatted = goodExamples
      .map((e) => {
        let text = `**Example${e.title ? ` - ${e.title}` : ''}**:`
        if (e.context) text += `\nContext: ${e.context}`
        if (e.input) text += `\nUser: ${e.input}`
        text += `\nResponse: ${e.output}`
        return text
      })
      .join('\n\n')
    sections.push(formatted)
  }

  if (badExamples.length > 0) {
    const formatted = badExamples
      .map((e) => {
        let text = `**Avoid${e.title ? ` - ${e.title}` : ''}**:`
        text += `\n${e.output}`
        if (e.explanation) text += `\nWhy to avoid: ${e.explanation}`
        return text
      })
      .join('\n\n')
    sections.push(formatted)
  }

  if (sections.length === 0) return ''

  let result = sections.join('\n\n---\n\n')
  if (estimateTokens(result) > TOKEN_BUDGET.examples) {
    result = truncateToTokens(result, TOKEN_BUDGET.examples)
  }

  return result
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Combine cached prompt sections from a profile into a single string.
 * Exported for use by chat-scoped knowledge merge logic.
 */
export function combinePromptSections(profile: KnowledgeProfile): string {
  const sections: string[] = []

  if (profile.voice_prompt) {
    sections.push(`### Voice & Style\n${profile.voice_prompt}`)
  }

  if (profile.strategy_prompt) {
    sections.push(`### Fundraising Approach\n${profile.strategy_prompt}`)
  }

  if (profile.knowledge_prompt) {
    sections.push(`### Organizational Knowledge\n${profile.knowledge_prompt}`)
  }

  if (profile.rules_prompt) {
    sections.push(`### Behavioral Rules\n${profile.rules_prompt}`)
  }

  return sections.join('\n\n---\n\n')
}

/**
 * Format a generated prompt for injection
 */
function formatGeneratedPrompt(generated: GeneratedKnowledgePrompt): string {
  const sections: string[] = []

  if (generated.voice) {
    sections.push(`### Voice & Style\n${generated.voice}`)
  }

  if (generated.strategy) {
    sections.push(`### Fundraising Approach\n${generated.strategy}`)
  }

  if (generated.knowledge) {
    sections.push(`### Organizational Knowledge\n${generated.knowledge}`)
  }

  if (generated.rules) {
    sections.push(`### Behavioral Rules\n${generated.rules}`)
  }

  if (generated.examples) {
    sections.push(`### Examples\n${generated.examples}`)
  }

  return sections.join('\n\n---\n\n')
}

/**
 * Group array items by a key
 */
function groupBy<T>(
  items: T[],
  key: keyof T
): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const value = String(item[key])
      if (!acc[value]) acc[value] = []
      acc[value].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}

/**
 * Format category name for display
 */
function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Truncate text to approximate token count.
 * Exported for use by chat-scoped knowledge merge logic.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4 // Rough estimate
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 3) + '...'
}
