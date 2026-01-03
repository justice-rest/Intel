/**
 * Prompt Builder
 *
 * Combines persona settings, knowledge profile, memory context, and chat overrides
 * into a unified system prompt. Respects priority order and token budgets.
 *
 * Priority (high to low):
 * 1. Chat-level custom system prompt (if mode = 'full')
 * 2. Persona system prompt (based on system_prompt_mode)
 * 3. Knowledge profile prompts
 * 4. Memory context (injected separately)
 * 5. Base system prompt
 */

import type {
  EffectiveChatConfig,
  ComputedSystemPrompt,
  PersonaVoiceConfig,
  SystemPromptMode,
} from './types'

// Token estimation (rough: 4 chars = 1 token)
const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/**
 * Build the effective system prompt by combining all layers
 */
export function buildEffectiveSystemPrompt(
  basePrompt: string,
  config: EffectiveChatConfig | null,
  options: {
    memoryContext?: string | null
    batchReportsContext?: string | null
    userName?: string | null
    maxTokens?: number
  } = {}
): ComputedSystemPrompt {
  const { memoryContext, batchReportsContext, userName, maxTokens = 8000 } = options

  const components = {
    base: true,
    persona: false,
    knowledge: false,
    memory: false,
    chat_override: false,
  }

  // Start with base prompt
  let effectivePrompt = basePrompt

  // If no config, just return base with optional context
  if (!config) {
    effectivePrompt = addOptionalContexts(effectivePrompt, {
      memoryContext,
      batchReportsContext,
      userName,
    })
    components.memory = !!memoryContext
    return {
      prompt: effectivePrompt,
      estimated_tokens: estimateTokens(effectivePrompt),
      components,
    }
  }

  // Apply persona prompt based on mode
  if (config.persona_system_prompt) {
    components.persona = true
    effectivePrompt = applyPersonaPrompt(
      effectivePrompt,
      config.persona_system_prompt,
      config.persona_prompt_mode || 'append',
      config.persona_name
    )
  }

  // Apply voice configuration
  if (config.voice_config) {
    effectivePrompt = applyVoiceConfig(effectivePrompt, config.voice_config)
  }

  // Apply knowledge profile prompt
  if (config.knowledge_prompt) {
    components.knowledge = true
    effectivePrompt = addKnowledgeContext(effectivePrompt, config.knowledge_prompt)
  }

  // Apply chat-level custom prompt (highest priority for overrides)
  if (config.custom_system_prompt) {
    components.chat_override = true
    effectivePrompt = addChatOverride(effectivePrompt, config.custom_system_prompt)
  }

  // Add optional contexts (memory, batch reports, user name)
  effectivePrompt = addOptionalContexts(effectivePrompt, {
    memoryContext,
    batchReportsContext,
    userName,
  })
  components.memory = !!memoryContext

  // Token budget enforcement
  const estimatedTokens = estimateTokens(effectivePrompt)
  if (estimatedTokens > maxTokens) {
    console.warn(
      `[PromptBuilder] System prompt exceeds token budget: ${estimatedTokens} > ${maxTokens}`
    )
    // Could implement truncation strategy here if needed
  }

  return {
    prompt: effectivePrompt,
    estimated_tokens: estimatedTokens,
    components,
  }
}

/**
 * Apply persona prompt based on the configured mode
 */
function applyPersonaPrompt(
  basePrompt: string,
  personaPrompt: string,
  mode: SystemPromptMode,
  personaName: string | null
): string {
  const personaHeader = personaName
    ? `## [PERSONA: ${personaName}]`
    : '## [PERSONA]'

  switch (mode) {
    case 'full':
      // Complete replacement - persona prompt becomes the entire prompt
      return `${personaPrompt}

---

${personaHeader}
This prompt fully replaces the default system prompt.
[/PERSONA]`

    case 'prepend':
      // Add persona prompt before base prompt
      return `${personaHeader}

${personaPrompt}

[/PERSONA]

---

${basePrompt}`

    case 'append':
      // Add persona prompt after base prompt (most common)
      return `${basePrompt}

---

${personaHeader}

${personaPrompt}

[/PERSONA]`

    case 'inject':
      // Look for injection marker in base prompt
      const marker = '<!-- PERSONA_INJECT -->'
      if (basePrompt.includes(marker)) {
        return basePrompt.replace(
          marker,
          `${personaHeader}

${personaPrompt}

[/PERSONA]`
        )
      }
      // If no marker found, fallback to append
      return `${basePrompt}

---

${personaHeader}

${personaPrompt}

[/PERSONA]`

    default:
      return `${basePrompt}

---

${personaHeader}

${personaPrompt}

[/PERSONA]`
  }
}

/**
 * Apply voice configuration as prompt guidance
 */
function applyVoiceConfig(prompt: string, voiceConfig: PersonaVoiceConfig): string {
  const voiceInstructions: string[] = []

  if (voiceConfig.tone) {
    voiceInstructions.push(`- **Tone**: ${voiceConfig.tone}`)
  }

  if (voiceConfig.formality_level) {
    const formalityDescriptions: Record<number, string> = {
      1: 'very casual, friendly',
      2: 'casual, approachable',
      3: 'balanced, professional-casual',
      4: 'professional, formal',
      5: 'highly formal, executive',
    }
    voiceInstructions.push(
      `- **Formality**: ${formalityDescriptions[voiceConfig.formality_level] || 'balanced'}`
    )
  }

  if (voiceConfig.use_emojis !== undefined) {
    voiceInstructions.push(
      `- **Emojis**: ${voiceConfig.use_emojis ? 'Use sparingly where appropriate' : 'Do not use emojis'}`
    )
  }

  if (voiceConfig.greeting_style) {
    voiceInstructions.push(`- **Greeting Style**: ${voiceConfig.greeting_style}`)
  }

  if (voiceConfig.signature) {
    voiceInstructions.push(`- **Signature**: End messages with: "${voiceConfig.signature}"`)
  }

  if (voiceInstructions.length === 0) {
    return prompt
  }

  return `${prompt}

---

## [VOICE STYLE]

Apply these communication preferences:

${voiceInstructions.join('\n')}

[/VOICE STYLE]`
}

/**
 * Add knowledge context from knowledge profile
 */
function addKnowledgeContext(prompt: string, knowledgePrompt: string): string {
  return `${prompt}

---

## [ORGANIZATIONAL KNOWLEDGE]

The following defines how you communicate and approach fundraising for THIS specific organization.
These instructions take precedence over generic advice.

${knowledgePrompt}

[/ORGANIZATIONAL KNOWLEDGE]`
}

/**
 * Add chat-level custom prompt override
 */
function addChatOverride(prompt: string, customPrompt: string): string {
  return `${prompt}

---

## [CHAT-SPECIFIC INSTRUCTIONS]

The following instructions are specific to this conversation and take highest priority:

${customPrompt}

[/CHAT-SPECIFIC INSTRUCTIONS]`
}

/**
 * Add optional context sections (memory, batch reports, user name)
 */
function addOptionalContexts(
  prompt: string,
  contexts: {
    memoryContext?: string | null
    batchReportsContext?: string | null
    userName?: string | null
  }
): string {
  let result = prompt

  // Add user name context
  if (contexts.userName) {
    result = `${result}

---

## [USER CONTEXT]
**Current User:** ${contexts.userName}

[HARD CONSTRAINTS]
1. ${contexts.userName} is the LOGGED-IN USER you are helping
2. NEVER confuse ${contexts.userName} with any donors or prospects being researched
3. When addressing the user, use "${contexts.userName}"—NOT donor names

[/USER CONTEXT]`
  }

  // Add memory context
  if (contexts.memoryContext) {
    result = `${result}

---

## [MEMORY CONTEXT]
The following are remembered facts about the user from previous conversations:

${contexts.memoryContext}

[FOCUS]
Use this context to personalize responses. Reference prior conversations naturally.
[/MEMORY CONTEXT]`
  }

  // Add batch reports context
  if (contexts.batchReportsContext) {
    result = `${result}

---

## [BATCH REPORTS CONTEXT]
${contexts.batchReportsContext}
[/BATCH REPORTS CONTEXT]`
  }

  return result
}

/**
 * Strip all injected context for display/preview purposes
 */
export function stripInjectedContexts(prompt: string): string {
  // Remove all bracketed sections like [USER CONTEXT], [MEMORY CONTEXT], etc.
  return prompt
    .replace(/## \[USER CONTEXT\][\s\S]*?\[\/USER CONTEXT\]/g, '')
    .replace(/## \[MEMORY CONTEXT\][\s\S]*?\[\/MEMORY CONTEXT\]/g, '')
    .replace(/## \[BATCH REPORTS CONTEXT\][\s\S]*?\[\/BATCH REPORTS CONTEXT\]/g, '')
    .replace(/## \[ORGANIZATIONAL KNOWLEDGE\][\s\S]*?\[\/ORGANIZATIONAL KNOWLEDGE\]/g, '')
    .replace(/## \[CHAT-SPECIFIC INSTRUCTIONS\][\s\S]*?\[\/CHAT-SPECIFIC INSTRUCTIONS\]/g, '')
    .replace(/## \[PERSONA[^\]]*\][\s\S]*?\[\/PERSONA\]/g, '')
    .replace(/## \[VOICE STYLE\][\s\S]*?\[\/VOICE STYLE\]/g, '')
    .replace(/---\n\n---/g, '---')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
