/**
 * Prospect Intelligence Engine
 *
 * The core orchestration engine that:
 * 1. Collects data from multiple sources in parallel
 * 2. Triangulates data for confidence scoring
 * 3. Synthesizes strategic insights using AI
 * 4. Returns comprehensive prospect intelligence
 */

import { linkupBatchSearch } from "@/lib/tools/linkup-prospect-research"
import { verifySecInsider, searchSecProxy } from "../verification"
import { verifyFecContributions } from "../verification"
import { searchNonprofits, getNonprofitDetails, verifyNonprofitAffiliations } from "../verification"
import { getRomyScore, RomyScoreDataPoints } from "@/lib/romy-score"
import { DATA_SOURCES, calculateTriangulatedConfidence, estimateEnrichmentCost } from "./data-sources"
import { synthesizeFullStrategy, ExecutiveSummary } from "./ai-synthesis"
import type {
  ProspectIntelligence,
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentMode,
  WealthIntelligence,
  PhilanthropicIntelligence,
  RelationshipIntelligence,
  TimingIntelligence,
  SourceCitation,
  DataConfidence,
  EnrichedDataPoint,
  PropertyIntelligence,
  BusinessIntelligence,
  SecuritiesIntelligence,
  AskStrategy,
  CultivationStrategy,
  ConversationIntelligence,
  CompetitiveIntelligence,
  TimingSignal,
} from "./types"

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createEnrichedDataPoint<T>(
  value: T,
  confidence: DataConfidence = "UNVERIFIED",
  sources: SourceCitation[] = []
): EnrichedDataPoint<T> {
  return {
    value,
    confidence,
    sources,
    lastVerified: new Date().toISOString(),
  }
}

function createSource(
  name: string,
  url: string,
  category: SourceCitation["category"],
  dataProvided: string
): SourceCitation {
  return {
    name,
    url,
    category,
    accessDate: new Date().toISOString(),
    dataProvided,
  }
}

// ============================================================================
// DATA COLLECTORS
// ============================================================================

interface CollectedData {
  linkupData?: any
  secData?: any
  fecData?: any
  nonprofitData?: any
  sources: SourceCitation[]
}

async function collectLinkupData(
  prospect: EnrichmentRequest["prospect"],
  mode: EnrichmentMode,
  apiKey?: string
): Promise<{ data: any; sources: SourceCitation[] }> {
  const sources: SourceCitation[] = []

  try {
    // Build query string
    const queryParts = [prospect.name]
    if (prospect.city) queryParts.push(prospect.city)
    if (prospect.state) queryParts.push(prospect.state)
    if (prospect.company) queryParts.push(prospect.company)

    const queryString = queryParts.join(", ")

    // Build full address
    const addressParts = [
      prospect.address,
      prospect.city,
      prospect.state,
      prospect.zip,
    ].filter(Boolean)
    const fullAddress = addressParts.join(", ")

    // Call linkupBatchSearch with prospect object
    const result = await linkupBatchSearch({
      name: prospect.name,
      address: fullAddress || undefined,
      employer: prospect.company,
      title: prospect.title,
    })

    // Add sources from LinkUp results
    if (result.sources) {
      result.sources.forEach(s => {
        sources.push(createSource(
          s.name || s.url,
          s.url,
          "WEB",
          "Web research data"
        ))
      })
    }

    return { data: result, sources }
  } catch (error) {
    console.error("[EnrichmentEngine] LinkUp error:", error)
    return { data: null, sources }
  }
}

async function collectSecData(
  prospectName: string
): Promise<{ data: any; sources: SourceCitation[] }> {
  const sources: SourceCitation[] = []

  try {
    const secResult = await verifySecInsider(prospectName)

    if (secResult && secResult.hasFilings) {
      sources.push(createSource(
        "SEC EDGAR",
        "https://www.sec.gov/cgi-bin/browse-edgar",
        "GOVERNMENT",
        "SEC insider filings (Form 3, 4, 5)"
      ))
    }

    return { data: secResult, sources }
  } catch (error) {
    console.error("[EnrichmentEngine] SEC error:", error)
    return { data: null, sources }
  }
}

async function collectFecData(
  prospectName: string
): Promise<{ data: any; sources: SourceCitation[] }> {
  const sources: SourceCitation[] = []

  try {
    const fecResult = await verifyFecContributions(prospectName)

    if (fecResult && fecResult.totalAmount && fecResult.totalAmount > 0) {
      sources.push(createSource(
        "Federal Election Commission",
        "https://www.fec.gov/data/receipts/individual-contributions/",
        "GOVERNMENT",
        "Political contribution records"
      ))
    }

    return { data: fecResult, sources }
  } catch (error) {
    console.error("[EnrichmentEngine] FEC error:", error)
    return { data: null, sources }
  }
}

async function collectNonprofitData(
  prospectName: string
): Promise<{ data: any; sources: SourceCitation[] }> {
  const sources: SourceCitation[] = []

  try {
    const nonprofitResult = await verifyNonprofitAffiliations(prospectName)

    if (nonprofitResult && nonprofitResult.affiliations && nonprofitResult.affiliations.length > 0) {
      sources.push(createSource(
        "ProPublica Nonprofit Explorer",
        "https://projects.propublica.org/nonprofits/",
        "NONPROFIT_990",
        "Nonprofit 990 filings and officer data"
      ))
    }

    return { data: nonprofitResult, sources }
  } catch (error) {
    console.error("[EnrichmentEngine] Nonprofit error:", error)
    return { data: null, sources }
  }
}

// ============================================================================
// DATA TRANSFORMER
// ============================================================================

function transformToWealth(collected: CollectedData): WealthIntelligence {
  const linkup = collected.linkupData?.structuredData
  const sec = collected.secData

  // Real estate
  const properties: PropertyIntelligence[] = []
  let totalRealEstateValue = 0

  if (linkup?.realEstate?.properties) {
    linkup.realEstate.properties.forEach((prop: any, index: number) => {
      const value = prop.value || prop.estimatedValue || 0
      totalRealEstateValue += value
      properties.push({
        address: prop.address || `Property ${index + 1}`,
        estimatedValue: createEnrichedDataPoint(value, "ESTIMATED", collected.sources.filter(s => s.category === "WEB")),
        propertyType: index === 0 ? "PRIMARY_RESIDENCE" : "INVESTMENT",
      })
    })
  }

  // Business ownership
  const businesses: BusinessIntelligence[] = []
  if (linkup?.businessOwnership) {
    linkup.businessOwnership.forEach((biz: any) => {
      businesses.push({
        companyName: biz.name || biz.companyName || "Unknown",
        role: createEnrichedDataPoint(biz.role || "Owner", "UNVERIFIED"),
        estimatedValue: biz.value ? createEnrichedDataPoint(biz.value, "ESTIMATED") : undefined,
        industry: biz.industry || "Unknown",
      })
    })
  }

  // Securities
  const hasSecFilings = sec?.hasFilings || false
  const secCompanies = sec?.companies?.map((c: any) => ({
    ticker: c.ticker || c.symbol,
    companyName: c.companyName || c.company,
    role: c.role || "Insider",
  })) || []

  const securities: SecuritiesIntelligence = {
    hasInsiderFilings: createEnrichedDataPoint(
      hasSecFilings,
      hasSecFilings ? "VERIFIED" : "UNVERIFIED",
      collected.sources.filter(s => s.name === "SEC EDGAR")
    ),
    companies: secCompanies,
  }

  // Net worth estimation
  const businessValue = businesses.reduce((sum, b) => sum + (b.estimatedValue?.value || 0), 0)
  const netWorthLow = totalRealEstateValue + businessValue
  const netWorthHigh = netWorthLow * 2  // Conservative multiplier

  return {
    realEstate: {
      totalValue: createEnrichedDataPoint(totalRealEstateValue, properties.length > 0 ? "ESTIMATED" : "UNVERIFIED"),
      propertyCount: properties.length,
      properties,
    },
    businessOwnership: businesses,
    securities,
    estimatedNetWorth: {
      low: createEnrichedDataPoint(netWorthLow, "ESTIMATED"),
      high: createEnrichedDataPoint(netWorthHigh, "ESTIMATED"),
      methodology: "Sum of real estate + business equity with 2x multiplier for high estimate",
    },
    liquidityIndicators: {
      inheritanceLikely: createEnrichedDataPoint(false, "UNVERIFIED"),
    },
  }
}

function transformToPhilanthropy(collected: CollectedData): PhilanthropicIntelligence {
  const fec = collected.fecData
  const nonprofits = collected.nonprofitData || []
  const linkup = collected.linkupData?.structuredData

  // Political giving
  const totalPolitical = fec?.totalAmount || 0
  let partyAffiliation: "REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "INDEPENDENT" | "NONE" = "NONE"

  if (fec?.partyBreakdown) {
    const rep = fec.partyBreakdown.republican || 0
    const dem = fec.partyBreakdown.democratic || 0
    if (rep > dem * 2) partyAffiliation = "REPUBLICAN"
    else if (dem > rep * 2) partyAffiliation = "DEMOCRATIC"
    else if (rep > 0 && dem > 0) partyAffiliation = "BIPARTISAN"
  }

  // Foundation affiliations
  const foundations = nonprofits.filter((n: any) => n.type === "foundation").map((n: any) => ({
    name: n.name,
    role: createEnrichedDataPoint(n.role || "Affiliated", "VERIFIED"),
    ein: n.ein,
    totalAssets: n.assets ? createEnrichedDataPoint(n.assets, "VERIFIED") : undefined,
    focusAreas: n.focusAreas || [],
  }))

  // Nonprofit boards
  const boards = nonprofits.filter((n: any) => n.role?.toLowerCase().includes("board") || n.role?.toLowerCase().includes("director")).map((n: any) => ({
    organization: n.name,
    role: createEnrichedDataPoint(n.role, "VERIFIED"),
    ein: n.ein,
  }))

  // Known major gifts from LinkUp
  const majorGifts = (linkup?.majorGifts || []).map((g: any) => ({
    organization: g.organization || g.org,
    amount: createEnrichedDataPoint(g.amount, "UNVERIFIED"),
    year: g.year || new Date().getFullYear(),
    source: collected.sources.find(s => s.category === "WEB") || createSource("Web", "", "WEB", "Gift data"),
  }))

  // Calculate giving capacity
  const estimatedAnnualGiving = totalPolitical + majorGifts.reduce((sum: number, g: any) => sum + (g.amount.value || 0), 0) / 5

  let capacityRating: "A" | "B" | "C" | "D" = "D"
  let capacityAmount = estimatedAnnualGiving * 5

  if (capacityAmount >= 1000000) capacityRating = "A"
  else if (capacityAmount >= 100000) capacityRating = "B"
  else if (capacityAmount >= 25000) capacityRating = "C"

  // Cause affinities from board memberships
  const causeAffinities = nonprofits.slice(0, 3).map((n: any) => ({
    cause: n.nteeCategory || n.cause || "Philanthropy",
    strength: "PRIMARY" as const,
    evidence: [`Board/donor at ${n.name}`],
  }))

  return {
    politicalGiving: {
      totalContributions: createEnrichedDataPoint(
        totalPolitical,
        totalPolitical > 0 ? "VERIFIED" : "UNVERIFIED",
        collected.sources.filter(s => s.name === "Federal Election Commission")
      ),
      partyAffiliation: createEnrichedDataPoint(partyAffiliation, totalPolitical > 0 ? "VERIFIED" : "UNVERIFIED"),
      recentContributions: (fec?.contributions || []).slice(0, 5).map((c: any) => ({
        recipient: c.committeeName || c.recipient,
        amount: c.amount,
        date: c.date,
        electionCycle: c.cycle || "2024",
      })),
      topCauses: [],
    },
    foundationAffiliations: foundations,
    nonprofitBoards: boards,
    knownMajorGifts: majorGifts,
    estimatedAnnualGiving: createEnrichedDataPoint(estimatedAnnualGiving, "ESTIMATED"),
    givingCapacity: {
      rating: capacityRating,
      amount: createEnrichedDataPoint(capacityAmount, "ESTIMATED"),
      methodology: "Based on political giving + known major gifts",
    },
    causeAffinities,
  }
}

function transformToRelationships(collected: CollectedData): RelationshipIntelligence {
  const linkup = collected.linkupData?.structuredData

  return {
    familyPhilanthropy: {
      spouse: linkup?.family?.spouse ? {
        name: linkup.family.spouse,
        philanthropicActivity: [],
      } : undefined,
      generationalWealth: createEnrichedDataPoint(false, "UNVERIFIED"),
    },
    professionalNetwork: [],
    boardConnections: [],
    socialCircle: {
      clubs: createEnrichedDataPoint(linkup?.clubs || [], "UNVERIFIED"),
      alumni: createEnrichedDataPoint(linkup?.education || [], "UNVERIFIED"),
    },
    potentialIntroducers: [],
  }
}

function transformToTiming(collected: CollectedData): TimingIntelligence {
  const signals: TimingSignal[] = []
  const sec = collected.secData

  // Add SEC-based timing signals
  if (sec?.hasFilings && sec?.recentTransactions?.length > 0) {
    signals.push({
      type: "LIQUIDITY_EVENT",
      description: "Recent SEC insider trading activity detected",
      urgency: "NEAR_TERM",
      actionRecommendation: "Review recent stock transactions for liquidity",
      source: createSource("SEC EDGAR", "https://www.sec.gov", "GOVERNMENT", "Insider transactions"),
    })
  }

  // Year-end giving signal
  const now = new Date()
  if (now.getMonth() >= 9) {  // October onwards
    signals.push({
      type: "SEASONAL",
      description: "Year-end giving season - optimal time for major gift asks",
      urgency: "IMMEDIATE",
      actionRecommendation: "Prioritize outreach for tax-advantaged giving before Dec 31",
      source: createSource("Internal", "", "WEB", "Seasonal pattern"),
    })
  }

  return {
    optimalAskWindow: {
      start: now.toISOString().split("T")[0],
      end: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      reasoning: "Based on seasonal patterns and detected signals",
    },
    activeSignals: signals,
    upcomingOpportunities: [],
  }
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

export async function enrichProspect(
  request: EnrichmentRequest,
  apiKey?: string
): Promise<EnrichmentResponse> {
  const startTime = Date.now()
  let apiCalls = 0
  let tokensUsed = 0

  try {
    console.log(`[EnrichmentEngine] Starting ${request.mode} enrichment for ${request.prospect.name}`)

    // Collect data from all sources in parallel
    const collectPromises: Promise<{ data: any; sources: SourceCitation[] }>[] = []

    // Always collect LinkUp data
    collectPromises.push(collectLinkupData(request.prospect, request.mode, apiKey))
    apiCalls++

    // For STANDARD and DEEP, also collect official data
    if (request.mode !== "QUICK_SCREEN") {
      collectPromises.push(collectSecData(request.prospect.name))
      collectPromises.push(collectFecData(request.prospect.name))
      collectPromises.push(collectNonprofitData(request.prospect.name))
      apiCalls += 3
    }

    const results = await Promise.allSettled(collectPromises)

    // Aggregate collected data
    const collected: CollectedData = {
      sources: [],
    }

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const { data, sources } = result.value
        collected.sources.push(...sources)

        if (index === 0) collected.linkupData = data
        else if (index === 1) collected.secData = data
        else if (index === 2) collected.fecData = data
        else if (index === 3) collected.nonprofitData = data
      }
    })

    // Transform to structured intelligence
    const wealth = transformToWealth(collected)
    const philanthropy = transformToPhilanthropy(collected)
    const relationships = request.options?.includeRelationships !== false
      ? transformToRelationships(collected)
      : undefined
    const timing = request.options?.includeTiming !== false
      ? transformToTiming(collected)
      : undefined

    // Calculate RōmyScore - map our data to RomyScoreDataPoints format
    const romyDataPoints: Partial<RomyScoreDataPoints> = {
      propertyValue: wealth.realEstate.totalValue.value,
      additionalPropertyCount: Math.max(0, wealth.realEstate.propertyCount - 1),
      businessRoles: wealth.businessOwnership.map(b => ({
        role: b.role.value,
        companyName: b.companyName,
        isPublicCompany: false,
      })),
      foundationAffiliations: philanthropy.foundationAffiliations.map(f => f.name),
      totalPoliticalGiving: philanthropy.politicalGiving.totalContributions.value,
    }

    // getRomyScore(name, city?, state?, newData?) - returns Promise<RomyScoreBreakdown>
    const romyResult = await getRomyScore(
      request.prospect.name,
      request.prospect.city,
      request.prospect.state,
      romyDataPoints
    )

    // AI synthesis for strategic intelligence
    const synthesisContext = {
      prospectName: request.prospect.name,
      wealth,
      philanthropy,
      relationships,
      timing,
      organizationContext: request.options?.organizationName,
      romyScore: romyResult.totalScore,
    }

    const synthesis = await synthesizeFullStrategy(synthesisContext, request.mode, apiKey)
    tokensUsed += 2000  // Approximate tokens for synthesis

    // Build complete intelligence output
    const intelligence: ProspectIntelligence = {
      prospect: {
        name: request.prospect.name,
        address: request.prospect.address,
        email: request.prospect.email,
        phone: request.prospect.phone,
      },
      metadata: {
        enrichmentMode: request.mode,
        generatedAt: new Date().toISOString(),
        dataFreshness: "REAL_TIME",
        sourcesUsed: collected.sources.length,
        confidenceScore: calculateConfidenceScore(collected),
        processingTimeMs: Date.now() - startTime,
      },
      wealth,
      philanthropy,
      relationships: relationships || {
        familyPhilanthropy: { generationalWealth: createEnrichedDataPoint(false, "UNVERIFIED") },
        professionalNetwork: [],
        boardConnections: [],
        socialCircle: { clubs: createEnrichedDataPoint([], "UNVERIFIED"), alumni: createEnrichedDataPoint([], "UNVERIFIED") },
        potentialIntroducers: [],
      },
      timing: timing || {
        optimalAskWindow: { start: "", end: "", reasoning: "" },
        activeSignals: [],
        upcomingOpportunities: [],
      },
      strategy: {
        ask: synthesis.askStrategy || createDefaultAskStrategy(philanthropy),
        cultivation: synthesis.cultivationStrategy || createDefaultCultivationStrategy(),
        conversation: synthesis.conversationIntelligence || createDefaultConversationIntelligence(),
        competitive: synthesis.competitiveIntelligence || createDefaultCompetitiveIntelligence(),
      },
      executiveSummary: {
        headline: synthesis.executiveSummary?.headline || `${request.prospect.name} - Prospect Profile`,
        keyInsights: synthesis.executiveSummary?.keyInsights || [],
        primaryOpportunity: synthesis.executiveSummary?.primaryOpportunity || "Further research needed",
        riskFactors: synthesis.executiveSummary?.riskFactors || [],
        romyScore: romyResult.totalScore,
        romyTier: romyResult.tier.name,
      },
      allSources: collected.sources,
    }

    console.log(`[EnrichmentEngine] Completed enrichment in ${Date.now() - startTime}ms`)

    return {
      success: true,
      intelligence,
      usage: {
        apiCalls,
        tokensUsed,
        estimatedCost: estimateEnrichmentCost(request.mode),
      },
    }
  } catch (error) {
    console.error("[EnrichmentEngine] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Enrichment failed",
      usage: {
        apiCalls,
        tokensUsed,
        estimatedCost: estimateEnrichmentCost(request.mode),
      },
    }
  }
}

// ============================================================================
// DEFAULT GENERATORS
// ============================================================================

function calculateConfidenceScore(collected: CollectedData): number {
  let score = 0
  const maxScore = 100

  // Weight sources by authority
  const governmentSources = collected.sources.filter(s => s.category === "GOVERNMENT").length
  const nonprofitSources = collected.sources.filter(s => s.category === "NONPROFIT_990").length
  const webSources = collected.sources.filter(s => s.category === "WEB").length

  score += governmentSources * 20  // High confidence from gov sources
  score += nonprofitSources * 15   // Good confidence from 990 data
  score += webSources * 5          // Some confidence from web

  return Math.min(score, maxScore)
}

function createDefaultAskStrategy(philanthropy: PhilanthropicIntelligence): AskStrategy {
  const capacity = philanthropy.givingCapacity.amount.value || 10000
  return {
    recommendedAmount: createEnrichedDataPoint(Math.round(capacity * 0.1), "ESTIMATED"),
    askRange: {
      floor: Math.round(capacity * 0.05),
      target: Math.round(capacity * 0.1),
      stretch: Math.round(capacity * 0.2),
    },
    giftVehicle: {
      recommended: "CASH",
      reasoning: "Default recommendation - update based on prospect profile",
      alternatives: ["STOCK", "DAF"],
    },
    approachStrategy: {
      bestSolicitor: "Development Officer",
      setting: "In-person meeting",
      framing: ["Mission alignment", "Impact opportunity", "Recognition"],
    },
  }
}

function createDefaultCultivationStrategy(): CultivationStrategy {
  return {
    readiness: "WARMING",
    readinessScore: 50,
    nextSteps: [
      {
        action: "Complete additional research",
        priority: "HIGH",
        timeline: "Within 1 week",
      },
      {
        action: "Schedule initial meeting",
        priority: "MEDIUM",
        timeline: "Within 2 weeks",
      },
    ],
  }
}

function createDefaultConversationIntelligence(): ConversationIntelligence {
  return {
    talkingPoints: [],
    interestAreas: [],
    avoidTopics: [],
    personalDetails: {},
  }
}

function createDefaultCompetitiveIntelligence(): CompetitiveIntelligence {
  return {
    otherOrganizationsSupported: [],
    differentiators: [],
    competitiveAdvantages: [],
    positioningRecommendation: "Highlight unique mission and impact",
  }
}

// Export types
export type { CollectedData }
