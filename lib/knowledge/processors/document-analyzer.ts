/**
 * Document Analyzer
 *
 * AI-powered document analysis that extracts organizational knowledge elements:
 * - Voice elements (tone, terminology, style)
 * - Strategy rules (cultivation, solicitation, stewardship)
 * - Knowledge facts (mission, programs, impact)
 * - Examples (good/bad communication examples)
 *
 * Uses Google Gemini for main analysis and OpenRouter (GPT-5 Nano) for classification.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import type {
  VoiceElementType,
  StrategyCategory,
  FactCategory,
  ProcessorAnalysisResults,
} from '../types'

// ============================================================================
// SCHEMAS
// ============================================================================

const VoiceElementSchema = z.object({
  element_type: z.enum([
    'tone',
    'formality',
    'terminology',
    'sentence_style',
    'emotional_register',
    'word_preference',
    'word_avoidance',
  ]),
  value: z.string().describe('The extracted value (e.g., "warm", "professional", "formal")'),
  description: z.string().optional().describe('Brief explanation of when/how to use this'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  source_excerpt: z.string().optional().describe('Text excerpt where this was found'),
})

const StrategyRuleSchema = z.object({
  category: z.enum([
    'cultivation',
    'solicitation',
    'stewardship',
    'objection_handling',
    'ask_philosophy',
    'donor_segmentation',
    'communication',
    'general',
  ]),
  rule: z.string().describe('The strategy rule or guideline'),
  rationale: z.string().optional().describe('Why this rule is important'),
  priority: z.number().min(1).max(10).describe('Priority 1-10, higher is more important'),
})

const FactSchema = z.object({
  category: z.enum([
    'organization',
    'mission',
    'programs',
    'impact',
    'staff',
    'board',
    'donors',
    'campaigns',
    'history',
    'values',
  ]),
  fact: z.string().describe('The organizational fact'),
  importance: z.number().min(0).max(1).describe('Importance score 0-1'),
})

const ExampleSchema = z.object({
  example_type: z.enum(['good', 'bad', 'template']),
  category: z.string().describe('Category like "thank-you", "appeal", "stewardship"'),
  title: z.string().optional(),
  context: z.string().optional().describe('When to use this example'),
  input: z.string().optional().describe('User prompt/context if applicable'),
  output: z.string().describe('The example text'),
  explanation: z.string().optional().describe('Why this is good/bad'),
})

const DocumentAnalysisSchema = z.object({
  voice_elements: z.array(VoiceElementSchema).describe('Extracted voice and style elements'),
  strategy_rules: z.array(StrategyRuleSchema).describe('Extracted strategy rules'),
  facts: z.array(FactSchema).describe('Extracted organizational facts'),
  examples: z.array(ExampleSchema).describe('Extracted communication examples'),
  summary: z.string().describe('Brief summary of what was extracted'),
  document_type: z.string().describe('Type of document analyzed'),
})

// ============================================================================
// MAIN ANALYZER
// ============================================================================

const ANALYSIS_PROMPT = `You are an expert nonprofit fundraising consultant analyzing organizational documents to help train an AI fundraising assistant.

Your task is to extract the following from the provided document:

## 1. VOICE ELEMENTS
Extract patterns that define HOW the organization communicates:
- **tone**: Overall emotional quality (warm, professional, urgent, inspiring, etc.)
- **formality**: Level of formality (casual, conversational, formal, academic)
- **terminology**: Specific words/phrases the organization uses
- **sentence_style**: Sentence structure preferences (short punchy vs long flowing)
- **emotional_register**: Emotional range (empathetic, hopeful, celebratory)
- **word_preference**: Words they prefer to use (e.g., "partners" instead of "donors")
- **word_avoidance**: Words to avoid (e.g., avoid "charity" use "impact")

## 2. STRATEGY RULES
Extract guidelines for fundraising approach:
- **cultivation**: How to build relationships with prospects
- **solicitation**: How/when to make asks
- **stewardship**: How to thank and retain donors
- **objection_handling**: How to address donor concerns
- **ask_philosophy**: Core beliefs about asking for gifts
- **donor_segmentation**: How they categorize donors
- **communication**: Preferred communication methods/timing
- **general**: Other strategic guidelines

## 3. KNOWLEDGE FACTS
Extract factual information about the organization:
- **mission**: Mission statement, vision, core purpose
- **organization**: Basic facts (founding year, location, size)
- **programs**: What programs/services they offer
- **impact**: Impact stories, statistics, outcomes
- **staff**: Key staff members and their roles
- **board**: Board members and their significance
- **campaigns**: Current or past campaigns
- **history**: Historical milestones
- **values**: Core organizational values

## 4. EXAMPLES
Extract communication examples:
- **good**: Examples of excellent donor communication to emulate
- **bad**: Examples of what to avoid (if mentioned)
- **template**: Templates or frameworks for communications

Be thorough but focus on QUALITY over quantity. Only extract elements you're confident about.
For confidence scores: 0.9+ = explicitly stated, 0.7-0.8 = strongly implied, 0.5-0.6 = inferred.`

export interface AnalyzeDocumentOptions {
  documentId: string
  profileId: string
  text: string
  fileName: string
  fileType: string
  docPurposes?: string[]
}

export interface AnalyzeDocumentResult {
  success: boolean
  analysis?: ProcessorAnalysisResults
  error?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Analyze a document and extract knowledge elements
 */
export async function analyzeDocument(
  options: AnalyzeDocumentOptions
): Promise<AnalyzeDocumentResult> {
  const { text, fileName, fileType, docPurposes } = options

  // Validate we have API key
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return {
      success: false,
      error: 'Google Generative AI API key not configured',
    }
  }

  // Truncate text if too long (max ~100k chars for context)
  const maxChars = 100000
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) + '\n...[truncated]' : text

  // Build context about the document
  const purposeContext = docPurposes?.length
    ? `\nDocument purposes indicated by user: ${docPurposes.join(', ')}`
    : ''

  const userPrompt = `Analyze this ${fileType} document named "${fileName}".${purposeContext}

---
DOCUMENT CONTENT:
---

${truncatedText}

---
END DOCUMENT
---

Extract voice elements, strategy rules, organizational facts, and examples from this document.
Focus on elements that would help an AI assistant communicate and advise in the voice of this organization.`

  try {
    const google = createGoogleGenerativeAI({ apiKey })

    const { object, usage } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: DocumentAnalysisSchema,
      system: ANALYSIS_PROMPT,
      prompt: userPrompt,
      temperature: 0.3, // Low temperature for consistency
    })

    // Transform to our types
    const analysis: ProcessorAnalysisResults = {
      voice_elements: object.voice_elements.map((v) => ({
        element_type: v.element_type as VoiceElementType,
        value: v.value,
        description: v.description,
        confidence: v.confidence,
        source_excerpt: v.source_excerpt,
      })),
      strategy_rules: object.strategy_rules.map((s) => ({
        category: s.category as StrategyCategory,
        rule: s.rule,
        rationale: s.rationale,
        priority: s.priority,
      })),
      facts: object.facts.map((f) => ({
        category: f.category as FactCategory,
        fact: f.fact,
        importance: f.importance,
      })),
      examples: object.examples.map((e) => ({
        example_type: e.example_type as 'good' | 'bad' | 'template',
        category: e.category,
        title: e.title,
        context: e.context,
        input: e.input,
        output: e.output,
        explanation: e.explanation,
      })),
      summary: object.summary,
      document_type: object.document_type,
    }

    return {
      success: true,
      analysis,
      tokenUsage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    }
  } catch (error) {
    console.error('Document analysis error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    }
  }
}

/**
 * Classify document purpose using AI
 */
export async function classifyDocumentPurpose(
  text: string,
  fileName: string
): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return []
  }

  // Use a smaller, faster model for classification
  const openrouter = createOpenRouter({ apiKey })

  const ClassificationSchema = z.object({
    purposes: z.array(
      z.enum(['voice', 'strategy', 'knowledge', 'examples', 'mixed'])
    ).describe('Primary purposes of this document'),
  })

  try {
    const { object } = await generateObject({
      model: openrouter('openai/gpt-5-nano'),
      schema: ClassificationSchema,
      prompt: `Classify this document's purpose for training a nonprofit fundraising AI.

File: ${fileName}
Content preview (first 2000 chars):
${text.slice(0, 2000)}

What is this document primarily useful for?
- voice: Defines communication style, tone, terminology
- strategy: Contains fundraising strategy, donor cultivation approaches
- knowledge: Contains organizational facts, mission, programs, impact
- examples: Contains sample communications, templates, or case studies
- mixed: Contains multiple types of content`,
      temperature: 0.1,
    })

    return object.purposes
  } catch (error) {
    console.error('Classification error:', error)
    return ['mixed'] // Default to mixed on error
  }
}
