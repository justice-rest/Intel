/**
 * Zod Schemas for Prospect Research Output
 *
 * These schemas provide strict validation for LLM-generated research data.
 * Used by the validated parser to ensure data quality and enable retry on validation failure.
 */

import { z } from "zod"

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const DataConfidenceSchema = z.enum(["VERIFIED", "ESTIMATED", "UNVERIFIED"])
export const ResearchConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"])
export const CapacityRatingSchema = z.enum(["MAJOR", "PRINCIPAL", "LEADERSHIP", "ANNUAL"])
export const PoliticalPartySchema = z.enum(["REPUBLICAN", "DEMOCRATIC", "BIPARTISAN", "NONE"])
export const ProspectReadinessSchema = z.enum(["NOT_READY", "WARMING", "READY", "URGENT"])
export const TaxSmartOptionSchema = z.enum(["QCD", "STOCK", "DAF", "NONE"])

// ============================================================================
// SOURCE SCHEMA
// ============================================================================

export const ResearchSourceSchema = z.object({
  title: z.string().min(1, "Source title is required"),
  url: z.string().url("Source URL must be valid").or(z.string().min(1)), // Allow non-URL strings for internal sources
  data_provided: z.string().min(1, "Source data_provided is required"),
})

// ============================================================================
// PROPERTY & BUSINESS SCHEMAS
// ============================================================================

export const PropertyRecordSchema = z.object({
  address: z.string().min(1, "Property address is required"),
  value: z.number().nonnegative("Property value must be non-negative"),
  source: z.string().min(1, "Property source is required"),
  confidence: DataConfidenceSchema,
})

export const BusinessRecordSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  role: z.string().min(1, "Role is required"),
  estimated_value: z.number().nonnegative().nullable(),
  source: z.string().min(1, "Business source is required"),
  confidence: DataConfidenceSchema,
})

export const MajorGiftRecordSchema = z.object({
  organization: z.string().min(1, "Gift organization is required"),
  amount: z.number().positive("Gift amount must be positive"),
  year: z.number().int().min(1900).max(2100).nullable(),
  source: z.string().min(1, "Gift source is required"),
})

// ============================================================================
// METRICS SCHEMA
// ============================================================================

export const ResearchMetricsSchema = z.object({
  estimated_net_worth_low: z.number().nonnegative().nullable(),
  estimated_net_worth_high: z.number().nonnegative().nullable(),
  estimated_gift_capacity: z.number().nonnegative().nullable(),
  capacity_rating: CapacityRatingSchema,
  romy_score: z.number().int().min(0).max(41),
  recommended_ask: z.number().nonnegative().nullable(),
  confidence_level: ResearchConfidenceSchema,
}).refine(
  (data) => {
    // If both low and high are provided, low should be <= high
    if (data.estimated_net_worth_low !== null && data.estimated_net_worth_high !== null) {
      return data.estimated_net_worth_low <= data.estimated_net_worth_high
    }
    return true
  },
  { message: "estimated_net_worth_low must be less than or equal to estimated_net_worth_high" }
)

// ============================================================================
// WEALTH SCHEMAS
// ============================================================================

export const RealEstateDataSchema = z.object({
  total_value: z.number().nonnegative().nullable(),
  properties: z.array(PropertyRecordSchema).default([]),
})

export const SecuritiesDataSchema = z.object({
  has_sec_filings: z.boolean(),
  insider_at: z.array(z.string()).default([]),
  source: z.string().nullable(),
})

export const ResearchWealthSchema = z.object({
  real_estate: RealEstateDataSchema,
  business_ownership: z.array(BusinessRecordSchema).default([]),
  securities: SecuritiesDataSchema,
})

// ============================================================================
// PHILANTHROPY SCHEMAS
// ============================================================================

export const PoliticalGivingDataSchema = z.object({
  total: z.number().nonnegative().default(0),
  party_lean: PoliticalPartySchema,
  source: z.enum(["FEC"]).nullable(),
})

export const ResearchPhilanthropySchema = z.object({
  political_giving: PoliticalGivingDataSchema,
  foundation_affiliations: z.array(z.string()).default([]),
  nonprofit_boards: z.array(z.string()).default([]),
  known_major_gifts: z.array(MajorGiftRecordSchema).default([]),
})

// ============================================================================
// BACKGROUND SCHEMAS
// ============================================================================

export const FamilyDataSchema = z.object({
  spouse: z.string().nullable(),
  children_count: z.number().int().nonnegative().nullable(),
})

export const ResearchBackgroundSchema = z.object({
  age: z.number().int().min(18).max(120).nullable(),
  education: z.array(z.string()).default([]),
  career_summary: z.string().default(""),
  family: FamilyDataSchema,
})

// ============================================================================
// STRATEGY SCHEMA
// ============================================================================

export const CultivationStrategySchema = z.object({
  readiness: ProspectReadinessSchema,
  next_steps: z.array(z.string()).default([]),
  best_solicitor: z.string().default("Unknown"),
  tax_smart_option: TaxSmartOptionSchema,
  talking_points: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
})

// ============================================================================
// COMPLETE PROSPECT RESEARCH OUTPUT SCHEMA
// ============================================================================

export const ProspectResearchOutputSchema = z.object({
  metrics: ResearchMetricsSchema,
  wealth: ResearchWealthSchema,
  philanthropy: ResearchPhilanthropySchema,
  background: ResearchBackgroundSchema,
  strategy: CultivationStrategySchema,
  sources: z.array(ResearchSourceSchema).default([]),
  executive_summary: z.string().min(1, "Executive summary is required"),
})

// ============================================================================
// LENIENT SCHEMA (for initial parsing, before correction)
// ============================================================================

/**
 * A more lenient version of the schema that accepts partial data
 * Used for initial parsing before sending validation errors back to LLM
 */
export const LenientProspectResearchOutputSchema = z.object({
  metrics: z.object({
    estimated_net_worth_low: z.number().nullable().optional().default(null),
    estimated_net_worth_high: z.number().nullable().optional().default(null),
    estimated_gift_capacity: z.number().nullable().optional().default(null),
    capacity_rating: CapacityRatingSchema.optional().default("ANNUAL"),
    romy_score: z.number().optional().default(0),
    recommended_ask: z.number().nullable().optional().default(null),
    confidence_level: ResearchConfidenceSchema.optional().default("LOW"),
  }),
  wealth: z.object({
    real_estate: z.object({
      total_value: z.number().nullable().optional().default(null),
      properties: z.array(z.any()).optional().default([]),
    }).optional().default({ total_value: null, properties: [] }),
    business_ownership: z.array(z.any()).optional().default([]),
    securities: z.object({
      has_sec_filings: z.boolean().optional().default(false),
      insider_at: z.array(z.string()).optional().default([]),
      source: z.string().nullable().optional().default(null),
    }).optional().default({ has_sec_filings: false, insider_at: [], source: null }),
  }).optional().default({
    real_estate: { total_value: null, properties: [] },
    business_ownership: [],
    securities: { has_sec_filings: false, insider_at: [], source: null },
  }),
  philanthropy: z.object({
    political_giving: z.object({
      total: z.number().optional().default(0),
      party_lean: PoliticalPartySchema.optional().default("NONE"),
      source: z.enum(["FEC"]).nullable().optional().default(null),
    }).optional().default({ total: 0, party_lean: "NONE", source: null }),
    foundation_affiliations: z.array(z.string()).optional().default([]),
    nonprofit_boards: z.array(z.string()).optional().default([]),
    known_major_gifts: z.array(z.any()).optional().default([]),
  }).optional().default({
    political_giving: { total: 0, party_lean: "NONE", source: null },
    foundation_affiliations: [],
    nonprofit_boards: [],
    known_major_gifts: [],
  }),
  background: z.object({
    age: z.number().nullable().optional().default(null),
    education: z.array(z.string()).optional().default([]),
    career_summary: z.string().optional().default(""),
    family: z.object({
      spouse: z.string().nullable().optional().default(null),
      children_count: z.number().nullable().optional().default(null),
    }).optional().default({ spouse: null, children_count: null }),
  }).optional().default({
    age: null,
    education: [],
    career_summary: "",
    family: { spouse: null, children_count: null },
  }),
  strategy: z.object({
    readiness: ProspectReadinessSchema.optional().default("NOT_READY"),
    next_steps: z.array(z.string()).optional().default([]),
    best_solicitor: z.string().optional().default("Unknown"),
    tax_smart_option: TaxSmartOptionSchema.optional().default("NONE"),
    talking_points: z.array(z.string()).optional().default([]),
    avoid: z.array(z.string()).optional().default([]),
  }).optional().default({
    readiness: "NOT_READY",
    next_steps: [],
    best_solicitor: "Unknown",
    tax_smart_option: "NONE",
    talking_points: [],
    avoid: [],
  }),
  sources: z.array(z.any()).optional().default([]),
  executive_summary: z.string().optional().default("Research could not be structured."),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedProspectResearchOutput = z.infer<typeof ProspectResearchOutputSchema>
export type LenientProspectResearchOutput = z.infer<typeof LenientProspectResearchOutputSchema>
export type ValidatedResearchMetrics = z.infer<typeof ResearchMetricsSchema>
export type ValidatedPropertyRecord = z.infer<typeof PropertyRecordSchema>
export type ValidatedBusinessRecord = z.infer<typeof BusinessRecordSchema>
export type ValidatedMajorGiftRecord = z.infer<typeof MajorGiftRecordSchema>
export type ValidatedResearchSource = z.infer<typeof ResearchSourceSchema>

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse prospect research output with detailed error messages
 */
export function validateProspectOutput(data: unknown): {
  success: boolean
  data?: ValidatedProspectResearchOutput
  errors?: z.ZodError
  errorSummary?: string
} {
  const result = ProspectResearchOutputSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Generate human-readable error summary
  const errorSummary = result.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ")

  return {
    success: false,
    errors: result.error,
    errorSummary,
  }
}

/**
 * Parse with lenient schema, returning defaults for missing fields
 */
export function parseLenientProspectOutput(data: unknown): LenientProspectResearchOutput {
  const result = LenientProspectResearchOutputSchema.safeParse(data)

  if (result.success) {
    return result.data
  }

  // If even lenient parsing fails, return absolute minimum
  return {
    metrics: {
      estimated_net_worth_low: null,
      estimated_net_worth_high: null,
      estimated_gift_capacity: null,
      capacity_rating: "ANNUAL",
      romy_score: 0,
      recommended_ask: null,
      confidence_level: "LOW",
    },
    wealth: {
      real_estate: { total_value: null, properties: [] },
      business_ownership: [],
      securities: { has_sec_filings: false, insider_at: [], source: null },
    },
    philanthropy: {
      political_giving: { total: 0, party_lean: "NONE", source: null },
      foundation_affiliations: [],
      nonprofit_boards: [],
      known_major_gifts: [],
    },
    background: {
      age: null,
      education: [],
      career_summary: "",
      family: { spouse: null, children_count: null },
    },
    strategy: {
      readiness: "NOT_READY",
      next_steps: [],
      best_solicitor: "Unknown",
      tax_smart_option: "NONE",
      talking_points: [],
      avoid: [],
    },
    sources: [],
    executive_summary: "Research could not be structured.",
  }
}

/**
 * Generate a correction prompt for LLM based on validation errors
 */
export function generateValidationErrorPrompt(errors: z.ZodError): string {
  const errorDetails = errors.errors.map((e) => {
    const path = e.path.join(".")
    const message = e.message

    // Provide specific guidance based on error type
    let guidance = ""
    if (e.code === "invalid_type") {
      guidance = ` (expected ${(e as any).expected}, got ${(e as any).received})`
    } else if (e.code === "invalid_enum_value") {
      guidance = ` (must be one of: ${(e as any).options?.join(", ")})`
    } else if (e.code === "too_small") {
      guidance = ` (minimum: ${(e as any).minimum})`
    } else if (e.code === "too_big") {
      guidance = ` (maximum: ${(e as any).maximum})`
    }

    return `- ${path}: ${message}${guidance}`
  })

  return `Your JSON response had validation errors. Please fix these issues and return corrected JSON:

${errorDetails.join("\n")}

Remember:
- capacity_rating must be "MAJOR", "PRINCIPAL", "LEADERSHIP", or "ANNUAL"
- romy_score must be 0-41
- confidence_level must be "HIGH", "MEDIUM", or "LOW"
- party_lean must be "REPUBLICAN", "DEMOCRATIC", "BIPARTISAN", or "NONE"
- All number values must be non-negative
- Use null (not undefined) for unknown values
- Ensure all required string fields are non-empty`
}
