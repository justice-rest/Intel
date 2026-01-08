/**
 * Pre-built Discovery Templates
 *
 * Curated prompt templates for common prospect discovery scenarios.
 * Each template includes placeholders that users can fill in.
 *
 * @module lib/discovery/templates
 */

import type { DiscoveryTemplate } from "./types"

/**
 * US States for select dropdowns
 */
export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming"
] as const

/**
 * Common cause areas for philanthropy templates
 */
export const CAUSE_AREAS = [
  "education",
  "healthcare",
  "arts and culture",
  "environment",
  "social services",
  "religious organizations",
  "youth development",
  "community development",
  "animal welfare",
  "international relief",
] as const

/**
 * Pre-built discovery templates
 */
export const DISCOVERY_TEMPLATES: DiscoveryTemplate[] = [
  {
    id: "tech-executives-city",
    title: "Tech Executives",
    description: "Technology company executives in a specific metro area who support education or STEM causes",
    prompt: `Find technology company executives (CEOs, CTOs, founders, VPs) in [city], [state] who have demonstrated interest in education, STEM, or innovation philanthropy.

SEARCH CRITERIA:
- Current or former executives at technology companies
- Located in or near [city], [state]
- Companies with $10M+ revenue or 50+ employees preferred
- Evidence of charitable giving, nonprofit board service, or foundation involvement

For each person found, provide:
- Full legal name
- Current title and company
- City and state
- Why they match the search criteria (philanthropic activity, board service, etc.)

Return specific individuals with verifiable identities. Each person should be findable via LinkedIn, news articles, or public records.`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
    ],
    category: "business",
    estimatedCostCents: 2,
    icon: "Cpu",
  },
  {
    id: "foundation-board-members",
    title: "Foundation Board Members",
    description: "Private foundation trustees and board members in a specific state",
    prompt: `Find private foundation board members, trustees, and directors in [city], [state].

SEARCH CRITERIA:
- Trustees or directors of private family foundations
- Focus on foundations with assets over $5 million
- Located in or near [city], [state]
- Include foundation name and role for each person
- Look for IRS Form 990-PF filings, ProPublica Nonprofit Explorer, GuideStar

For each person found, provide:
- Full legal name
- Foundation name and role (Trustee, Director, President, etc.)
- City and state
- Foundation focus areas if known

Search sources:
- ProPublica Nonprofit Explorer (990-PF filings)
- GuideStar/Candid foundation profiles
- Foundation websites and annual reports
- News articles about foundation grants`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
    ],
    category: "philanthropy",
    estimatedCostCents: 2,
    icon: "Bank",
  },
  {
    id: "real-estate-investors",
    title: "Real Estate Investors",
    description: "Commercial real estate investors and developers with philanthropic involvement",
    prompt: `Find commercial real estate investors, property developers, and real estate executives in [city], [state] who have demonstrated philanthropic involvement.

SEARCH CRITERIA:
- Owners or executives of commercial real estate companies
- Property developers with significant portfolios
- Evidence of nonprofit board service or charitable giving
- Located in or operating in [city], [state]

For each person found, provide:
- Full legal name
- Company/firm name and role
- City and state
- Philanthropic involvement (boards, donations, foundations)

Look for:
- Real estate development company executives
- Commercial property owners
- REIT executives with local ties
- Developers who have named buildings after themselves (wealth indicator)`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
    ],
    category: "wealth",
    estimatedCostCents: 2,
    icon: "Buildings",
  },
  {
    id: "healthcare-executives",
    title: "Healthcare Executives",
    description: "Hospital administrators and healthcare leaders with nonprofit board experience",
    prompt: `Find healthcare executives in [city], [state] who have nonprofit board experience or foundation affiliations.

SEARCH CRITERIA:
- Hospital CEOs, CFOs, CMOs, and administrators
- Health system executives
- Pharmaceutical and medical device company leaders
- Healthcare private equity partners
- Located in or near [city], [state]
- Evidence of nonprofit board service outside their organization

For each person found, provide:
- Full legal name
- Current title and organization
- City and state
- Nonprofit board positions or philanthropic activity

Search:
- Hospital and health system leadership pages
- Healthcare industry publications
- University hospital boards of trustees
- Medical school advisory boards`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
    ],
    category: "business",
    estimatedCostCents: 2,
    icon: "FirstAid",
  },
  {
    id: "retired-fortune-500",
    title: "Retired Fortune 500 Executives",
    description: "Former Fortune 500 executives now serving on boards",
    prompt: `Find retired Fortune 500 executives living in [city], [state] who now serve on corporate boards, university boards, or nonprofit boards.

SEARCH CRITERIA:
- Former CEOs, CFOs, COOs, or division presidents of Fortune 500 companies
- Currently retired or in advisory/board roles
- Living in or connected to [city], [state]
- Active on multiple boards (indicates capacity and engagement)

For each person found, provide:
- Full legal name
- Former company and highest role achieved
- Current city and state
- Current board positions (corporate, nonprofit, university)

Search:
- Corporate proxy statements (DEF 14A) for board members
- University board of trustees listings
- Major nonprofit board rosters
- Executive retirement announcements`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
    ],
    category: "business",
    estimatedCostCents: 2,
    icon: "UserCircle",
  },
  {
    id: "family-foundation-trustees",
    title: "Family Foundation Trustees",
    description: "Multi-generational family foundation leaders focused on a specific cause",
    prompt: `Find trustees and directors of family foundations in [city], [state] that focus on [cause].

SEARCH CRITERIA:
- Family foundation trustees (not just donors)
- Foundations that have made grants to [cause] organizations
- Located in or near [city], [state]
- Multi-generational family involvement preferred
- Foundations with ongoing grantmaking activity

For each person found, provide:
- Full legal name
- Foundation name and role
- City and state
- Connection to [cause] (grants made, personal involvement)

Search:
- ProPublica Nonprofit Explorer for 990-PF filings
- Foundation grant databases
- Charity Navigator foundation profiles
- News about major grants to [cause] organizations
- [cause] organization donor recognition lists`,
    placeholders: [
      { key: "[city]", label: "City", type: "text", required: true },
      { key: "[state]", label: "State", type: "text", required: true },
      {
        key: "[cause]",
        label: "Cause Area",
        type: "text",
        required: true,
        defaultValue: "education",
      },
    ],
    category: "philanthropy",
    estimatedCostCents: 2,
    icon: "Users",
  },
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): DiscoveryTemplate | undefined {
  return DISCOVERY_TEMPLATES.find((t) => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: DiscoveryTemplate["category"]
): DiscoveryTemplate[] {
  return DISCOVERY_TEMPLATES.filter((t) => t.category === category)
}

/**
 * Fill template placeholders with values
 *
 * @param template - The template to fill
 * @param values - Map of placeholder keys to values
 * @returns Filled prompt string
 * @throws Error if required placeholders are missing
 */
export function fillTemplatePlaceholders(
  template: DiscoveryTemplate,
  values: Record<string, string>
): string {
  let prompt = template.prompt

  // Check for missing required placeholders
  const missingRequired: string[] = []
  for (const placeholder of template.placeholders || []) {
    const value = values[placeholder.key]
    if (placeholder.required && (!value || value.trim() === "")) {
      missingRequired.push(placeholder.label)
    }
  }

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required fields: ${missingRequired.join(", ")}`
    )
  }

  // Replace all placeholders
  for (const placeholder of template.placeholders || []) {
    const value = values[placeholder.key] || placeholder.defaultValue || ""
    // Use global replace to handle multiple occurrences
    prompt = prompt.split(placeholder.key).join(value)
  }

  return prompt
}

/**
 * Validate placeholder values for a template
 */
export function validatePlaceholderValues(
  template: DiscoveryTemplate,
  values: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const placeholder of template.placeholders || []) {
    const value = values[placeholder.key]

    if (placeholder.required && (!value || value.trim() === "")) {
      errors.push(`${placeholder.label} is required`)
      continue
    }

    if (value) {
      // Validate length
      if (value.length > 100) {
        errors.push(`${placeholder.label} must be less than 100 characters`)
      }

      // Basic sanitization check
      if (/<script|javascript:|data:/i.test(value)) {
        errors.push(`${placeholder.label} contains invalid characters`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get all unique categories
 */
export function getCategories(): DiscoveryTemplate["category"][] {
  const categories = new Set(DISCOVERY_TEMPLATES.map((t) => t.category))
  return Array.from(categories)
}

/**
 * Category display names
 */
export const CATEGORY_LABELS: Record<DiscoveryTemplate["category"], string> = {
  business: "Business & Executive",
  philanthropy: "Philanthropy & Foundations",
  wealth: "Wealth Indicators",
  demographics: "Demographics",
}
