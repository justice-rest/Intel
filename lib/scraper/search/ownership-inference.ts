/**
 * Ownership Inference Module
 *
 * Infers ownership likelihood from officer/director roles.
 * For small businesses, officers (President, CEO, Manager) are typically owners.
 *
 * Ownership Confidence Levels:
 * - confirmed: SEC filing proves 10%+ ownership
 * - high: Executive role strongly indicates ownership (small business)
 * - medium: Director/Agent role may or may not indicate ownership
 * - low: Minor role or unclear relationship
 */

/**
 * Ownership likelihood levels
 */
export type OwnershipLikelihood = "confirmed" | "high" | "medium" | "low"

/**
 * Ownership inference result
 */
export interface OwnershipInference {
  likelihood: OwnershipLikelihood
  reason: string
  score: number // 0-1 numeric score
}

/**
 * Role categories for inference
 */
const EXECUTIVE_ROLES = [
  // C-Suite
  "ceo", "chief executive officer", "chief executive",
  "cfo", "chief financial officer", "chief financial",
  "coo", "chief operating officer", "chief operating",
  "cto", "chief technology officer", "chief technology",
  "cmo", "chief marketing officer",

  // Presidents
  "president", "vice president", "vp",
  "executive vice president", "evp",
  "senior vice president", "svp",

  // LLC Managers (typically owner-managers)
  "managing member", "manager", "member-manager",
  "sole member", "member",

  // Partners
  "general partner", "managing partner", "partner",
  "limited partner", "lp",

  // Owners explicitly listed
  "owner", "sole owner", "co-owner",
  "proprietor", "sole proprietor",
  "founder", "co-founder",
  "principal", "managing principal",
]

const DIRECTOR_ROLES = [
  "director", "board member", "board of directors",
  "chairman", "chairwoman", "chair",
  "vice chairman", "vice chair",
  "independent director", "outside director",
  "lead director",
]

const OFFICER_ROLES = [
  "secretary", "treasurer", "controller",
  "officer", "corporate officer",
  "assistant secretary", "assistant treasurer",
  "general counsel", "legal counsel",
]

const AGENT_ROLES = [
  "registered agent", "statutory agent",
  "agent for service", "agent",
  "resident agent",
]

const SEC_INSIDER_ROLES = [
  "10% owner", "10 percent owner", "ten percent owner",
  "beneficial owner", "insider",
  "section 16 officer", "reporting person",
]

/**
 * Normalize a role string for comparison
 */
function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

/**
 * Check if role matches any in a list
 */
function matchesRoleList(role: string, roleList: string[]): boolean {
  const normalized = normalizeRole(role)
  return roleList.some(r => normalized.includes(r) || r.includes(normalized))
}

/**
 * Infer ownership likelihood from a single role
 */
export function inferOwnershipFromRole(role: string): OwnershipInference {
  const normalized = normalizeRole(role)

  // SEC insider (confirmed)
  if (matchesRoleList(normalized, SEC_INSIDER_ROLES)) {
    return {
      likelihood: "confirmed",
      reason: "SEC filing confirms insider status (officer, director, or 10%+ owner)",
      score: 1.0,
    }
  }

  // Executive roles (high)
  if (matchesRoleList(normalized, EXECUTIVE_ROLES)) {
    return {
      likelihood: "high",
      reason: "Executive position strongly indicates ownership for small businesses",
      score: 0.85,
    }
  }

  // Director roles (medium)
  if (matchesRoleList(normalized, DIRECTOR_ROLES)) {
    return {
      likelihood: "medium",
      reason: "Directors may or may not have equity stakes",
      score: 0.5,
    }
  }

  // Officer roles (medium-low)
  if (matchesRoleList(normalized, OFFICER_ROLES)) {
    return {
      likelihood: "medium",
      reason: "Corporate officers may have equity but not always",
      score: 0.4,
    }
  }

  // Registered agent (low-medium)
  if (matchesRoleList(normalized, AGENT_ROLES)) {
    return {
      likelihood: "low",
      reason: "Registered agents are often service providers, not owners",
      score: 0.2,
    }
  }

  // Unknown role
  return {
    likelihood: "low",
    reason: "Role does not clearly indicate ownership",
    score: 0.1,
  }
}

/**
 * Infer ownership likelihood from multiple roles
 */
export function inferOwnershipFromRoles(roles: string[]): OwnershipInference {
  if (!roles || roles.length === 0) {
    return {
      likelihood: "low",
      reason: "No roles found",
      score: 0,
    }
  }

  // Get inference for each role
  const inferences = roles.map(inferOwnershipFromRole)

  // Find the highest confidence inference
  const best = inferences.reduce((a, b) => (a.score > b.score ? a : b))

  // If multiple high-confidence roles, boost score
  const highConfidenceCount = inferences.filter(i => i.likelihood === "high" || i.likelihood === "confirmed").length
  if (highConfidenceCount > 1) {
    return {
      likelihood: "high",
      reason: `Multiple executive roles (${highConfidenceCount}) strongly indicate ownership`,
      score: Math.min(0.95, best.score + 0.1 * (highConfidenceCount - 1)),
    }
  }

  return best
}

/**
 * Entity type modifiers for ownership inference
 */
export type EntityType = "llc" | "corporation" | "partnership" | "sole_proprietorship" | "nonprofit" | "unknown"

/**
 * Detect entity type from name
 */
export function detectEntityType(entityName: string): EntityType {
  const name = entityName.toLowerCase()

  if (name.includes("llc") || name.includes("l.l.c") || name.includes("limited liability")) {
    return "llc"
  }

  if (name.includes("inc") || name.includes("incorporated") || name.includes("corp") || name.includes("corporation")) {
    return "corporation"
  }

  if (name.includes("lp") || name.includes("l.p") || name.includes("limited partnership") || name.includes("llp")) {
    return "partnership"
  }

  if (name.includes("foundation") || name.includes("nonprofit") || name.includes("501(c)")) {
    return "nonprofit"
  }

  return "unknown"
}

/**
 * Adjust inference based on entity type
 */
export function adjustForEntityType(
  inference: OwnershipInference,
  entityType: EntityType
): OwnershipInference {
  // LLCs: Manager = Owner in most cases
  if (entityType === "llc" && inference.likelihood === "high") {
    return {
      ...inference,
      score: Math.min(0.95, inference.score + 0.1),
      reason: inference.reason + ". LLC managers are typically member-owners.",
    }
  }

  // Sole proprietorship: Owner is clearly the owner
  if (entityType === "sole_proprietorship") {
    return {
      likelihood: "high",
      reason: "Sole proprietorship - individual is the owner",
      score: 0.95,
    }
  }

  // Nonprofits: Directors typically don't "own" the org
  if (entityType === "nonprofit" && inference.likelihood !== "confirmed") {
    return {
      likelihood: "low",
      reason: "Nonprofit organizations have no owners - directors serve in governance roles",
      score: 0.1,
    }
  }

  return inference
}

/**
 * Source-based confidence modifiers
 */
export type DataSource = "sec_edgar" | "state_registry" | "opencorporates" | "other"

/**
 * Adjust inference based on data source
 */
export function adjustForSource(
  inference: OwnershipInference,
  source: DataSource
): OwnershipInference {
  // SEC EDGAR is authoritative for public companies
  if (source === "sec_edgar") {
    if (inference.likelihood === "high") {
      return {
        likelihood: "confirmed",
        reason: "SEC filing confirms insider/ownership status",
        score: 1.0,
      }
    }
    return inference
  }

  // State registry is reliable but may not show all owners
  if (source === "state_registry") {
    return inference
  }

  // OpenCorporates aggregates data - slightly less reliable
  if (source === "opencorporates") {
    return {
      ...inference,
      score: inference.score * 0.9, // 10% discount
    }
  }

  return inference
}

/**
 * Complete ownership inference with all factors
 */
export function inferOwnership(
  roles: string[],
  entityName: string,
  source: DataSource
): OwnershipInference {
  // Base inference from roles
  let inference = inferOwnershipFromRoles(roles)

  // Adjust for entity type
  const entityType = detectEntityType(entityName)
  inference = adjustForEntityType(inference, entityType)

  // Adjust for source
  inference = adjustForSource(inference, source)

  return inference
}

/**
 * Categorize likelihood for display
 */
export function getLikelihoodLabel(likelihood: OwnershipLikelihood): string {
  switch (likelihood) {
    case "confirmed":
      return "Confirmed Owner"
    case "high":
      return "Likely Owner"
    case "medium":
      return "Possible Owner"
    case "low":
      return "Unlikely Owner"
  }
}

/**
 * Get color for likelihood (for UI)
 */
export function getLikelihoodColor(likelihood: OwnershipLikelihood): string {
  switch (likelihood) {
    case "confirmed":
      return "green"
    case "high":
      return "blue"
    case "medium":
      return "yellow"
    case "low":
      return "gray"
  }
}
