/**
 * Prospect Intelligence Engine - Types
 *
 * Revolutionary prospect enrichment system that goes beyond competitors like
 * DonorSearch, iWave, WealthEngine, and Windfall by providing:
 *
 * 1. Multi-source triangulation with per-field confidence scoring
 * 2. AI-synthesized strategic briefs (not just data dumps)
 * 3. Gift timing intelligence (optimal moment to ask)
 * 4. Relationship mapping (board connections, shared networks)
 * 5. Competitive giving intelligence (where else they give)
 * 6. Actionable cultivation strategy
 */

// ============================================================================
// CONFIDENCE & SOURCE TYPES
// ============================================================================

/**
 * Confidence level for each data point
 * - VERIFIED: From official/authoritative source (SEC, FEC, County Assessor, IRS 990)
 * - CORROBORATED: Found in 2+ independent sources
 * - ESTIMATED: Calculated from indicators with methodology shown
 * - UNVERIFIED: Single web source, treat with caution
 */
export type DataConfidence = "VERIFIED" | "CORROBORATED" | "ESTIMATED" | "UNVERIFIED"

/**
 * Source category for attribution
 */
export type SourceCategory =
  | "GOVERNMENT"      // SEC, FEC, County Assessor, IRS
  | "NONPROFIT_990"   // ProPublica 990 data
  | "NEWS"            // News articles
  | "CORPORATE"       // Company websites, press releases
  | "SOCIAL"          // LinkedIn, social media
  | "FINANCIAL"       // Stock exchanges, financial reports
  | "WEB"             // General web search
  | "CRM"             // User's CRM data

/**
 * Source citation with full attribution
 */
export interface SourceCitation {
  name: string
  url: string
  category: SourceCategory
  accessDate: string
  dataProvided: string  // What this source contributed
}

/**
 * A data point with confidence scoring and source attribution
 */
export interface EnrichedDataPoint<T> {
  value: T
  confidence: DataConfidence
  sources: SourceCitation[]
  lastVerified?: string
  notes?: string
}

// ============================================================================
// WEALTH INTELLIGENCE
// ============================================================================

export interface PropertyIntelligence {
  address: string
  estimatedValue: EnrichedDataPoint<number>
  purchasePrice?: EnrichedDataPoint<number>
  purchaseDate?: string
  propertyType: "PRIMARY_RESIDENCE" | "VACATION" | "INVESTMENT" | "COMMERCIAL" | "UNKNOWN"
  equity?: EnrichedDataPoint<number>  // If mortgage data available
  appreciationSinceAcquisition?: number
}

export interface BusinessIntelligence {
  companyName: string
  role: EnrichedDataPoint<string>
  ownershipPercentage?: EnrichedDataPoint<number>
  estimatedValue?: EnrichedDataPoint<number>
  industry: string
  employeeCount?: EnrichedDataPoint<string>
  yearFounded?: number
  recentNews?: string[]
  liquidityEvents?: Array<{
    type: "IPO" | "ACQUISITION" | "MERGER" | "FUNDING" | "SALE"
    date?: string
    amount?: EnrichedDataPoint<number>
  }>
}

export interface SecuritiesIntelligence {
  hasInsiderFilings: EnrichedDataPoint<boolean>
  companies: Array<{
    ticker: string
    companyName: string
    role: string
    latestFiling?: {
      date: string
      type: string
      sharesHeld?: number
      estimatedValue?: number
    }
  }>
  vestingSchedules?: Array<{
    company: string
    vestDate: string
    estimatedShares: number
    estimatedValue: number
  }>
}

export interface WealthIntelligence {
  realEstate: {
    totalValue: EnrichedDataPoint<number>
    propertyCount: number
    properties: PropertyIntelligence[]
  }
  businessOwnership: BusinessIntelligence[]
  securities: SecuritiesIntelligence
  estimatedNetWorth: {
    low: EnrichedDataPoint<number>
    high: EnrichedDataPoint<number>
    methodology: string
  }
  liquidityIndicators: {
    recentSales?: EnrichedDataPoint<number>
    stockVesting?: EnrichedDataPoint<number>
    inheritanceLikely: EnrichedDataPoint<boolean>
  }
}

// ============================================================================
// PHILANTHROPIC INTELLIGENCE
// ============================================================================

export interface PoliticalGivingIntelligence {
  totalContributions: EnrichedDataPoint<number>
  partyAffiliation: EnrichedDataPoint<"REPUBLICAN" | "DEMOCRATIC" | "BIPARTISAN" | "INDEPENDENT" | "NONE">
  recentContributions: Array<{
    recipient: string
    amount: number
    date: string
    electionCycle: string
  }>
  topCauses: string[]
}

export interface FoundationIntelligence {
  name: string
  role: EnrichedDataPoint<string>  // Trustee, Board Member, Founder, etc.
  ein?: string
  totalAssets?: EnrichedDataPoint<number>
  annualGiving?: EnrichedDataPoint<number>
  focusAreas: string[]
}

export interface MajorGiftRecord {
  organization: string
  amount: EnrichedDataPoint<number>
  year: number
  giftType?: "CASH" | "STOCK" | "REAL_ESTATE" | "PLANNED" | "IN_KIND" | "UNKNOWN"
  recognition?: string  // Named fund, building, etc.
  source: SourceCitation
}

export interface PhilanthropicIntelligence {
  politicalGiving: PoliticalGivingIntelligence
  foundationAffiliations: FoundationIntelligence[]
  nonprofitBoards: Array<{
    organization: string
    role: EnrichedDataPoint<string>
    since?: string
    ein?: string
  }>
  knownMajorGifts: MajorGiftRecord[]
  estimatedAnnualGiving: EnrichedDataPoint<number>
  givingCapacity: {
    rating: "A" | "B" | "C" | "D"
    amount: EnrichedDataPoint<number>
    methodology: string
  }
  causeAffinities: Array<{
    cause: string
    strength: "PRIMARY" | "SECONDARY" | "EMERGING"
    evidence: string[]
  }>
}

// ============================================================================
// RELATIONSHIP INTELLIGENCE
// ============================================================================

export interface ConnectionIntelligence {
  name: string
  relationship: string  // "Spouse", "Business Partner", "Board Colleague", etc.
  connectionStrength: "STRONG" | "MODERATE" | "WEAK"
  sharedAffiliations: string[]
  potentialIntroducer: boolean
}

export interface RelationshipIntelligence {
  familyPhilanthropy: {
    spouse?: {
      name: string
      philanthropicActivity?: string[]
    }
    familyFoundation?: FoundationIntelligence
    generationalWealth: EnrichedDataPoint<boolean>
  }
  professionalNetwork: ConnectionIntelligence[]
  boardConnections: Array<{
    organization: string
    sharedBoardMembers: string[]
    connectionPath: string  // How they're connected
  }>
  socialCircle: {
    clubs: EnrichedDataPoint<string[]>
    alumni: EnrichedDataPoint<string[]>
  }
  potentialIntroducers: Array<{
    name: string
    connection: string
    strength: "STRONG" | "MODERATE"
  }>
}

// ============================================================================
// TIMING INTELLIGENCE
// ============================================================================

export type TimingSignalType =
  | "LIQUIDITY_EVENT"      // IPO, acquisition, stock sale
  | "LIFE_EVENT"           // Retirement, milestone birthday, award
  | "CAREER_CHANGE"        // New role, promotion
  | "SEASONAL"             // Year-end giving, tax planning
  | "NEWS_TRIGGER"         // Positive press, company success
  | "VESTING_SCHEDULE"     // Stock options vesting

export interface TimingSignal {
  type: TimingSignalType
  description: string
  date?: string
  urgency: "IMMEDIATE" | "NEAR_TERM" | "FUTURE"
  actionRecommendation: string
  source: SourceCitation
}

export interface TimingIntelligence {
  optimalAskWindow: {
    start: string
    end: string
    reasoning: string
  }
  activeSignals: TimingSignal[]
  upcomingOpportunities: Array<{
    event: string
    estimatedDate: string
    type: TimingSignalType
  }>
  seasonalPatterns?: {
    preferredGivingMonth?: number
    yearEndGiver: EnrichedDataPoint<boolean>
  }
}

// ============================================================================
// STRATEGIC INTELLIGENCE (AI-SYNTHESIZED)
// ============================================================================

export interface AskStrategy {
  recommendedAmount: EnrichedDataPoint<number>
  askRange: {
    floor: number
    target: number
    stretch: number
  }
  giftVehicle: {
    recommended: "CASH" | "STOCK" | "DAF" | "REAL_ESTATE" | "PLANNED_GIFT" | "QCD"
    reasoning: string
    alternatives: string[]
  }
  approachStrategy: {
    bestSolicitor: string  // Who should make the ask
    setting: string        // Where to have the conversation
    framing: string[]      // Key points to emphasize
  }
}

export interface CultivationStrategy {
  readiness: "NOT_READY" | "WARMING" | "READY" | "URGENT"
  readinessScore: number  // 0-100
  nextSteps: Array<{
    action: string
    priority: "HIGH" | "MEDIUM" | "LOW"
    timeline: string
    owner?: string
  }>
  engagementHistory?: {
    lastContact?: string
    touchpoints: number
    engagementLevel: "COLD" | "WARM" | "HOT"
  }
}

export interface ConversationIntelligence {
  talkingPoints: Array<{
    topic: string
    hook: string        // How to bring it up
    connection: string  // Why this matters to them
  }>
  interestAreas: string[]
  avoidTopics: Array<{
    topic: string
    reason: string
  }>
  personalDetails: {
    preferredName?: string
    communicationPreference?: "EMAIL" | "PHONE" | "IN_PERSON" | "MAIL"
    bestTimeToContact?: string
  }
}

export interface CompetitiveIntelligence {
  otherOrganizationsSupported: Array<{
    organization: string
    estimatedAmount?: EnrichedDataPoint<number>
    relationship: string  // Board, major donor, annual fund, etc.
  }>
  differentiators: string[]  // Why they should give to YOU
  competitiveAdvantages: string[]
  positioningRecommendation: string
}

// ============================================================================
// COMPLETE PROSPECT INTELLIGENCE OUTPUT
// ============================================================================

export interface ProspectIntelligence {
  // Identification
  prospect: {
    name: string
    address?: string
    email?: string
    phone?: string
  }

  // Research metadata
  metadata: {
    enrichmentMode: "QUICK_SCREEN" | "STANDARD" | "DEEP_INTELLIGENCE"
    generatedAt: string
    dataFreshness: "REAL_TIME" | "RECENT" | "CACHED"
    sourcesUsed: number
    confidenceScore: number  // 0-100 overall confidence
    processingTimeMs: number
  }

  // Core intelligence sections
  wealth: WealthIntelligence
  philanthropy: PhilanthropicIntelligence
  relationships: RelationshipIntelligence
  timing: TimingIntelligence

  // AI-synthesized strategy
  strategy: {
    ask: AskStrategy
    cultivation: CultivationStrategy
    conversation: ConversationIntelligence
    competitive: CompetitiveIntelligence
  }

  // Executive summary (AI-generated)
  executiveSummary: {
    headline: string           // One-line summary
    keyInsights: string[]      // 3-5 bullet points
    primaryOpportunity: string // The main opportunity
    riskFactors: string[]      // Potential concerns
    romyScore: number          // 0-41
    romyTier: string           // Platinum, Gold, etc.
  }

  // Full source list with deduplication
  allSources: SourceCitation[]
}

// ============================================================================
// ENRICHMENT REQUEST/RESPONSE
// ============================================================================

export type EnrichmentMode = "QUICK_SCREEN" | "STANDARD" | "DEEP_INTELLIGENCE"

export interface EnrichmentRequest {
  prospect: {
    name: string
    address?: string
    city?: string
    state?: string
    zip?: string
    email?: string
    phone?: string
    company?: string
    title?: string
    additionalContext?: string
  }
  mode: EnrichmentMode
  options?: {
    includeRelationships?: boolean
    includeTiming?: boolean
    includeCompetitive?: boolean
    organizationName?: string  // For competitive positioning
    existingDonorIds?: string[]  // For relationship mapping
  }
}

export interface EnrichmentResponse {
  success: boolean
  intelligence?: ProspectIntelligence
  error?: string
  usage: {
    apiCalls: number
    tokensUsed: number
    estimatedCost: number
  }
}

// ============================================================================
// BATCH ENRICHMENT
// ============================================================================

export interface BatchEnrichmentJob {
  id: string
  userId: string
  name: string
  mode: EnrichmentMode
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
  progress: {
    total: number
    completed: number
    failed: number
  }
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface BatchEnrichmentItem {
  id: string
  jobId: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED"
  input: EnrichmentRequest["prospect"]
  output?: ProspectIntelligence
  error?: string
  processingTimeMs?: number
}
