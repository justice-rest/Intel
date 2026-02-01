/**
 * AI Synthesis Engine
 *
 * Uses AI to synthesize raw data into strategic intelligence:
 * - Executive summary generation
 * - Ask strategy recommendations
 * - Cultivation planning
 * - Conversation intelligence
 * - Competitive positioning
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import type {
  ProspectIntelligence,
  WealthIntelligence,
  PhilanthropicIntelligence,
  RelationshipIntelligence,
  TimingIntelligence,
  AskStrategy,
  CultivationStrategy,
  ConversationIntelligence,
  CompetitiveIntelligence,
  EnrichmentMode,
  SourceCitation,
} from "./types"

// ============================================================================
// CONFIGURATION
// ============================================================================

const SYNTHESIS_MODEL = "gemini-3-flash-preview"
const MAX_TOKENS = 4096
const TEMPERATURE = 0.3  // Lower for more consistent outputs

// ============================================================================
// SYNTHESIS PROMPTS
// ============================================================================

const EXECUTIVE_SUMMARY_PROMPT = `You are an elite prospect research analyst creating an executive summary for a nonprofit fundraiser.

Given the following prospect data, create a compelling executive summary that answers:
1. Who is this person and why should we approach them?
2. What is their giving capacity and likelihood to give?
3. What is the primary opportunity?
4. What are the key risk factors?

Be specific, cite numbers, and focus on actionable insights. This summary will be used to prioritize cultivation efforts.

Format your response as JSON:
{
  "headline": "One compelling sentence about this prospect",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"],
  "primaryOpportunity": "The main opportunity for engagement",
  "riskFactors": ["Risk 1", "Risk 2"]
}

PROSPECT DATA:
`

const ASK_STRATEGY_PROMPT = `You are a senior major gifts officer with 20+ years of experience crafting successful solicitation strategies.

Given the prospect's wealth profile, giving history, and philanthropic interests, recommend:
1. The optimal ask amount (with reasoning)
2. The best gift vehicle (cash, stock, DAF, planned gift, QCD)
3. Who should make the ask
4. Where and how to have the conversation
5. Key framing points

Consider their net worth, liquidity, giving patterns, and cause affinities.

Format your response as JSON:
{
  "recommendedAmount": 50000,
  "reasoning": "Why this amount",
  "askRange": {
    "floor": 25000,
    "target": 50000,
    "stretch": 100000
  },
  "giftVehicle": {
    "recommended": "STOCK",
    "reasoning": "Why this vehicle",
    "alternatives": ["DAF", "CASH"]
  },
  "approachStrategy": {
    "bestSolicitor": "Who should ask",
    "setting": "Where to have the conversation",
    "framing": ["Key point 1", "Key point 2", "Key point 3"]
  }
}

PROSPECT DATA:
`

const CULTIVATION_STRATEGY_PROMPT = `You are a prospect development expert planning a cultivation strategy.

Based on the prospect's current relationship status and engagement history, provide:
1. Readiness assessment (NOT_READY, WARMING, READY, URGENT)
2. Readiness score (0-100)
3. Next 3-5 concrete action steps with priorities and timelines

Be specific and actionable.

Format your response as JSON:
{
  "readiness": "WARMING",
  "readinessScore": 65,
  "nextSteps": [
    {
      "action": "Specific action to take",
      "priority": "HIGH",
      "timeline": "Within 2 weeks"
    }
  ]
}

PROSPECT DATA:
`

const CONVERSATION_INTELLIGENCE_PROMPT = `You are preparing a fundraiser for a meeting with a major donor prospect.

Create conversation intelligence:
1. 3-5 talking points with hooks (how to bring it up) and connections (why it matters to them)
2. Interest areas to explore
3. Topics to avoid (with reasons)
4. Personal details for rapport building

Format your response as JSON:
{
  "talkingPoints": [
    {
      "topic": "Topic name",
      "hook": "How to bring it up naturally",
      "connection": "Why this resonates with them"
    }
  ],
  "interestAreas": ["Interest 1", "Interest 2"],
  "avoidTopics": [
    {
      "topic": "Topic to avoid",
      "reason": "Why"
    }
  ],
  "personalDetails": {
    "preferredName": "Name they prefer",
    "communicationPreference": "IN_PERSON",
    "bestTimeToContact": "When to reach them"
  }
}

PROSPECT DATA:
`

const COMPETITIVE_INTELLIGENCE_PROMPT = `You are analyzing a prospect's giving landscape to position your organization competitively.

Based on their known giving to other organizations, provide:
1. List of other organizations they support (if known)
2. Key differentiators - why they should give to THIS organization
3. Competitive advantages to emphasize
4. Positioning recommendation

Format your response as JSON:
{
  "otherOrganizationsSupported": [
    {
      "organization": "Org name",
      "estimatedAmount": 10000,
      "relationship": "Board member"
    }
  ],
  "differentiators": ["Unique value 1", "Unique value 2"],
  "competitiveAdvantages": ["Advantage 1", "Advantage 2"],
  "positioningRecommendation": "How to position your ask"
}

PROSPECT DATA:
`

// ============================================================================
// SYNTHESIS FUNCTIONS
// ============================================================================

interface SynthesisContext {
  prospectName: string
  wealth?: WealthIntelligence
  philanthropy?: PhilanthropicIntelligence
  relationships?: RelationshipIntelligence
  timing?: TimingIntelligence
  organizationContext?: string
  romyScore?: number
}

function buildDataContext(ctx: SynthesisContext): string {
  const parts: string[] = []

  parts.push(`Name: ${ctx.prospectName}`)

  if (ctx.wealth) {
    const netWorthLow = ctx.wealth.estimatedNetWorth.low.value
    const netWorthHigh = ctx.wealth.estimatedNetWorth.high.value
    parts.push(`\nWealth Profile:`)
    parts.push(`- Estimated Net Worth: $${formatNumber(netWorthLow)} - $${formatNumber(netWorthHigh)}`)
    parts.push(`- Real Estate: $${formatNumber(ctx.wealth.realEstate.totalValue.value)} (${ctx.wealth.realEstate.propertyCount} properties)`)
    if (ctx.wealth.businessOwnership.length > 0) {
      parts.push(`- Business Ownership: ${ctx.wealth.businessOwnership.map(b => b.companyName).join(", ")}`)
    }
    if (ctx.wealth.securities.hasInsiderFilings.value) {
      parts.push(`- SEC Insider at: ${ctx.wealth.securities.companies.map(c => c.ticker).join(", ")}`)
    }
  }

  if (ctx.philanthropy) {
    parts.push(`\nPhilanthropic Profile:`)
    parts.push(`- Giving Capacity: ${ctx.philanthropy.givingCapacity.rating} ($${formatNumber(ctx.philanthropy.givingCapacity.amount.value)})`)
    parts.push(`- Political Giving: $${formatNumber(ctx.philanthropy.politicalGiving.totalContributions.value)} (${ctx.philanthropy.politicalGiving.partyAffiliation.value})`)
    if (ctx.philanthropy.foundationAffiliations.length > 0) {
      parts.push(`- Foundation Affiliations: ${ctx.philanthropy.foundationAffiliations.map(f => f.name).join(", ")}`)
    }
    if (ctx.philanthropy.nonprofitBoards.length > 0) {
      parts.push(`- Nonprofit Boards: ${ctx.philanthropy.nonprofitBoards.map(b => b.organization).join(", ")}`)
    }
    if (ctx.philanthropy.knownMajorGifts.length > 0) {
      parts.push(`- Known Major Gifts:`)
      ctx.philanthropy.knownMajorGifts.forEach(g => {
        parts.push(`  - ${g.organization}: $${formatNumber(g.amount.value)} (${g.year})`)
      })
    }
    if (ctx.philanthropy.causeAffinities.length > 0) {
      parts.push(`- Cause Affinities: ${ctx.philanthropy.causeAffinities.map(c => c.cause).join(", ")}`)
    }
  }

  if (ctx.relationships) {
    parts.push(`\nRelationship Intelligence:`)
    if (ctx.relationships.familyPhilanthropy.spouse) {
      parts.push(`- Spouse: ${ctx.relationships.familyPhilanthropy.spouse.name}`)
    }
    if (ctx.relationships.potentialIntroducers.length > 0) {
      parts.push(`- Potential Introducers: ${ctx.relationships.potentialIntroducers.map(i => i.name).join(", ")}`)
    }
  }

  if (ctx.timing) {
    parts.push(`\nTiming Intelligence:`)
    if (ctx.timing.activeSignals.length > 0) {
      parts.push(`- Active Signals:`)
      ctx.timing.activeSignals.forEach(s => {
        parts.push(`  - ${s.type}: ${s.description} (${s.urgency})`)
      })
    }
    if (ctx.timing.optimalAskWindow) {
      parts.push(`- Optimal Ask Window: ${ctx.timing.optimalAskWindow.start} to ${ctx.timing.optimalAskWindow.end}`)
    }
  }

  if (ctx.romyScore !== undefined) {
    parts.push(`\nRōmyScore: ${ctx.romyScore}/41`)
  }

  if (ctx.organizationContext) {
    parts.push(`\nOrganization Context: ${ctx.organizationContext}`)
  }

  return parts.join("\n")
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "Unknown"
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return num.toLocaleString()
}

async function synthesize<T>(
  prompt: string,
  context: SynthesisContext,
  apiKey?: string
): Promise<T | null> {
  try {
    const google = createGoogleGenerativeAI({
      apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })

    const dataContext = buildDataContext(context)
    const fullPrompt = prompt + dataContext

    const result = await generateText({
      model: google(SYNTHESIS_MODEL),
      messages: [{ role: "user", content: fullPrompt }],
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    })

    // Extract JSON from response
    const text = result.text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("[AISynthesis] No JSON found in response")
      return null
    }

    return JSON.parse(jsonMatch[0]) as T
  } catch (error) {
    console.error("[AISynthesis] Error:", error)
    return null
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface ExecutiveSummary {
  headline: string
  keyInsights: string[]
  primaryOpportunity: string
  riskFactors: string[]
}

export async function generateExecutiveSummary(
  context: SynthesisContext,
  apiKey?: string
): Promise<ExecutiveSummary | null> {
  return synthesize<ExecutiveSummary>(EXECUTIVE_SUMMARY_PROMPT, context, apiKey)
}

export async function generateAskStrategy(
  context: SynthesisContext,
  apiKey?: string
): Promise<Omit<AskStrategy, "recommendedAmount"> & { recommendedAmount: number; reasoning: string } | null> {
  return synthesize(ASK_STRATEGY_PROMPT, context, apiKey)
}

export async function generateCultivationStrategy(
  context: SynthesisContext,
  apiKey?: string
): Promise<CultivationStrategy | null> {
  return synthesize<CultivationStrategy>(CULTIVATION_STRATEGY_PROMPT, context, apiKey)
}

export async function generateConversationIntelligence(
  context: SynthesisContext,
  apiKey?: string
): Promise<ConversationIntelligence | null> {
  return synthesize<ConversationIntelligence>(CONVERSATION_INTELLIGENCE_PROMPT, context, apiKey)
}

export async function generateCompetitiveIntelligence(
  context: SynthesisContext,
  apiKey?: string
): Promise<CompetitiveIntelligence | null> {
  return synthesize<CompetitiveIntelligence>(COMPETITIVE_INTELLIGENCE_PROMPT, context, apiKey)
}

/**
 * Full strategic synthesis - generates all AI insights for a prospect
 */
export async function synthesizeFullStrategy(
  context: SynthesisContext,
  mode: EnrichmentMode,
  apiKey?: string
): Promise<{
  executiveSummary: ExecutiveSummary | null
  askStrategy: AskStrategy | null
  cultivationStrategy: CultivationStrategy | null
  conversationIntelligence: ConversationIntelligence | null
  competitiveIntelligence: CompetitiveIntelligence | null
}> {
  // Quick screen only gets executive summary
  if (mode === "QUICK_SCREEN") {
    const executiveSummary = await generateExecutiveSummary(context, apiKey)
    return {
      executiveSummary,
      askStrategy: null,
      cultivationStrategy: null,
      conversationIntelligence: null,
      competitiveIntelligence: null,
    }
  }

  // Standard gets summary + ask strategy + cultivation
  if (mode === "STANDARD") {
    const [executiveSummary, askStrategyRaw, cultivationStrategy] = await Promise.all([
      generateExecutiveSummary(context, apiKey),
      generateAskStrategy(context, apiKey),
      generateCultivationStrategy(context, apiKey),
    ])

    const askStrategy: AskStrategy | null = askStrategyRaw ? {
      recommendedAmount: {
        value: askStrategyRaw.recommendedAmount,
        confidence: "ESTIMATED",
        sources: [],
      },
      askRange: askStrategyRaw.askRange,
      giftVehicle: askStrategyRaw.giftVehicle,
      approachStrategy: askStrategyRaw.approachStrategy,
    } : null

    return {
      executiveSummary,
      askStrategy,
      cultivationStrategy,
      conversationIntelligence: null,
      competitiveIntelligence: null,
    }
  }

  // Deep intelligence gets everything
  const [
    executiveSummary,
    askStrategyRaw,
    cultivationStrategy,
    conversationIntelligence,
    competitiveIntelligence,
  ] = await Promise.all([
    generateExecutiveSummary(context, apiKey),
    generateAskStrategy(context, apiKey),
    generateCultivationStrategy(context, apiKey),
    generateConversationIntelligence(context, apiKey),
    generateCompetitiveIntelligence(context, apiKey),
  ])

  const askStrategy: AskStrategy | null = askStrategyRaw ? {
    recommendedAmount: {
      value: askStrategyRaw.recommendedAmount,
      confidence: "ESTIMATED",
      sources: [],
    },
    askRange: askStrategyRaw.askRange,
    giftVehicle: askStrategyRaw.giftVehicle,
    approachStrategy: askStrategyRaw.approachStrategy,
  } : null

  return {
    executiveSummary,
    askStrategy,
    cultivationStrategy,
    conversationIntelligence,
    competitiveIntelligence,
  }
}
