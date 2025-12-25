/**
 * Name Disambiguation Scoring
 *
 * Calculates confidence scores for name matches across different
 * data sources to reduce false positives and improve accuracy.
 *
 * Problem: "John Smith in California" could match dozens of people.
 * Solution: Score matches based on multiple factors to identify the right person.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PersonContext {
  name: string
  city?: string
  state?: string
  employer?: string
  title?: string
  age?: number
  address?: string
}

export interface MatchCandidate {
  name: string
  city?: string
  state?: string
  employer?: string
  title?: string
  source: string
  rawData?: unknown
}

export interface DisambiguationScore {
  overallScore: number // 0-1
  confidence: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW"
  factors: {
    nameMatch: number
    locationMatch: number
    employerMatch: number
    titleMatch: number
  }
  isLikelyMatch: boolean
  warnings: string[]
}

// ============================================================================
// NAME MATCHING
// ============================================================================

/**
 * Common nickname mappings
 */
const NICKNAME_MAP: Record<string, string[]> = {
  william: ["will", "bill", "billy", "willy", "liam"],
  robert: ["rob", "bob", "bobby", "robbie"],
  richard: ["rick", "dick", "rich", "richie"],
  james: ["jim", "jimmy", "jamie"],
  john: ["jack", "johnny", "jon"],
  michael: ["mike", "mikey", "mick"],
  charles: ["charlie", "chuck", "chas"],
  thomas: ["tom", "tommy"],
  joseph: ["joe", "joey"],
  daniel: ["dan", "danny"],
  david: ["dave", "davey"],
  edward: ["ed", "eddie", "ted", "teddy"],
  elizabeth: ["liz", "lizzy", "beth", "betsy", "betty"],
  margaret: ["maggie", "marge", "peggy", "meg"],
  patricia: ["pat", "patty", "tricia"],
  jennifer: ["jen", "jenny"],
  katherine: ["kate", "katie", "kathy", "cathy", "kat"],
  alexandra: ["alex", "sandy", "sasha"],
  anthony: ["tony"],
  benjamin: ["ben", "benny"],
  christopher: ["chris", "kit"],
  douglas: ["doug"],
  frederick: ["fred", "freddy", "fritz"],
  gregory: ["greg"],
  jonathan: ["jon", "jonny"],
  lawrence: ["larry"],
  matthew: ["matt", "matty"],
  nathaniel: ["nate", "nat", "nathan"],
  nicholas: ["nick", "nicky"],
  patrick: ["pat", "paddy"],
  peter: ["pete"],
  phillip: ["phil"],
  raymond: ["ray"],
  samuel: ["sam", "sammy"],
  stephen: ["steve", "stevie"],
  theodore: ["ted", "teddy", "theo"],
  timothy: ["tim", "timmy"],
  walter: ["walt", "wally"],
  alexander: ["alex", "al", "xander"],
}

/**
 * Normalize a name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "") // Remove non-letters
    .replace(/\s+/g, " ") // Normalize spaces
    .trim()
}

/**
 * Extract first and last name from full name
 */
function parseName(fullName: string): { first: string; last: string; middle?: string } {
  const parts = normalizeName(fullName).split(" ").filter(Boolean)

  if (parts.length === 0) {
    return { first: "", last: "" }
  }

  if (parts.length === 1) {
    return { first: parts[0], last: "" }
  }

  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] }
  }

  // 3+ parts: first, middle(s), last
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  }
}

/**
 * Check if two first names could be the same person (including nicknames)
 */
function firstNameMatches(name1: string, name2: string): { matches: boolean; score: number } {
  const n1 = normalizeName(name1)
  const n2 = normalizeName(name2)

  // Exact match
  if (n1 === n2) {
    return { matches: true, score: 1.0 }
  }

  // Check if one is a nickname of the other
  for (const [formal, nicknames] of Object.entries(NICKNAME_MAP)) {
    const allVariants = [formal, ...nicknames]
    if (allVariants.includes(n1) && allVariants.includes(n2)) {
      return { matches: true, score: 0.9 }
    }
  }

  // Check for initial match (e.g., "J" matches "John")
  if (n1.length === 1 && n2.startsWith(n1)) {
    return { matches: true, score: 0.6 }
  }
  if (n2.length === 1 && n1.startsWith(n2)) {
    return { matches: true, score: 0.6 }
  }

  // Check for prefix match (e.g., "Jon" matches "Jonathan")
  if (n1.length >= 3 && n2.startsWith(n1)) {
    return { matches: true, score: 0.7 }
  }
  if (n2.length >= 3 && n1.startsWith(n2)) {
    return { matches: true, score: 0.7 }
  }

  return { matches: false, score: 0 }
}

/**
 * Calculate name similarity score
 */
function calculateNameScore(targetName: string, candidateName: string): number {
  const target = parseName(targetName)
  const candidate = parseName(candidateName)

  // Last name must match or be very similar
  const lastNameMatch =
    target.last === candidate.last
      ? 1.0
      : levenshteinSimilarity(target.last, candidate.last) > 0.8
        ? 0.8
        : 0

  if (lastNameMatch === 0) {
    return 0 // Different last name = different person
  }

  // First name matching (with nicknames)
  const firstMatch = firstNameMatches(target.first, candidate.first)

  if (!firstMatch.matches) {
    return 0 // Different first name = different person
  }

  // Combine scores
  return lastNameMatch * 0.5 + firstMatch.score * 0.5
}

/**
 * Levenshtein distance-based similarity
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[s1.length][s2.length]
  return 1 - distance / Math.max(s1.length, s2.length)
}

// ============================================================================
// LOCATION MATCHING
// ============================================================================

/**
 * US State abbreviation mappings
 */
const STATE_ABBREV: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
}

// Reverse mapping
const ABBREV_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREV).map(([k, v]) => [v, k])
)

/**
 * Normalize state to abbreviation
 */
function normalizeState(state: string | undefined): string | null {
  if (!state) return null

  const normalized = state.toLowerCase().trim()

  // Already an abbreviation
  if (normalized.length === 2 && ABBREV_TO_STATE[normalized]) {
    return normalized
  }

  // Full state name
  return STATE_ABBREV[normalized] || null
}

/**
 * Calculate location match score
 */
function calculateLocationScore(
  targetCity: string | undefined,
  targetState: string | undefined,
  candidateCity: string | undefined,
  candidateState: string | undefined
): number {
  let score = 0

  // State matching (most important for location)
  const targetStateNorm = normalizeState(targetState)
  const candidateStateNorm = normalizeState(candidateState)

  if (targetStateNorm && candidateStateNorm) {
    if (targetStateNorm === candidateStateNorm) {
      score += 0.6 // Same state
    } else {
      // Different state - significant penalty but not disqualifying
      // (people move, FEC records might be outdated)
      score -= 0.2
    }
  } else if (targetStateNorm || candidateStateNorm) {
    // One has state, other doesn't - neutral
    score += 0.1
  }

  // City matching
  if (targetCity && candidateCity) {
    const targetCityNorm = targetCity.toLowerCase().trim()
    const candidateCityNorm = candidateCity.toLowerCase().trim()

    if (targetCityNorm === candidateCityNorm) {
      score += 0.4 // Same city
    } else if (
      targetCityNorm.includes(candidateCityNorm) ||
      candidateCityNorm.includes(targetCityNorm)
    ) {
      score += 0.2 // Partial city match (e.g., "San Francisco" vs "San Francisco Bay Area")
    }
  }

  return Math.max(0, Math.min(1, score))
}

// ============================================================================
// EMPLOYER/TITLE MATCHING
// ============================================================================

/**
 * Normalize company name for comparison
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|corporation|incorporated|limited)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Calculate employer match score
 */
function calculateEmployerScore(
  targetEmployer: string | undefined,
  candidateEmployer: string | undefined
): number {
  if (!targetEmployer || !candidateEmployer) {
    return 0 // No employer data to compare
  }

  const targetNorm = normalizeCompanyName(targetEmployer)
  const candidateNorm = normalizeCompanyName(candidateEmployer)

  if (targetNorm === candidateNorm) {
    return 1.0 // Exact match
  }

  // Check for significant word overlap
  const targetWords = new Set(targetNorm.split(" ").filter((w) => w.length > 2))
  const candidateWords = new Set(candidateNorm.split(" ").filter((w) => w.length > 2))

  let matchCount = 0
  for (const word of targetWords) {
    if (candidateWords.has(word)) {
      matchCount++
    }
  }

  const overlapRatio =
    matchCount / Math.max(targetWords.size, candidateWords.size) ||
    (targetWords.size === 0 && candidateWords.size === 0 ? 0 : 0)

  return overlapRatio
}

/**
 * Calculate title match score
 */
function calculateTitleScore(
  targetTitle: string | undefined,
  candidateTitle: string | undefined
): number {
  if (!targetTitle || !candidateTitle) {
    return 0
  }

  const targetNorm = targetTitle.toLowerCase().trim()
  const candidateNorm = candidateTitle.toLowerCase().trim()

  if (targetNorm === candidateNorm) {
    return 1.0
  }

  // Check for executive-level keywords
  const executiveKeywords = ["ceo", "cfo", "coo", "cto", "president", "chairman", "founder", "director", "vp", "vice president", "chief", "owner", "partner"]

  const targetIsExec = executiveKeywords.some(k => targetNorm.includes(k))
  const candidateIsExec = executiveKeywords.some(k => candidateNorm.includes(k))

  if (targetIsExec && candidateIsExec) {
    return 0.6 // Both executive-level
  }

  return 0.3 // Some title is better than none
}

// ============================================================================
// MAIN DISAMBIGUATION FUNCTION
// ============================================================================

/**
 * Calculate disambiguation score between a target person and a candidate match
 */
export function calculateDisambiguationScore(
  target: PersonContext,
  candidate: MatchCandidate
): DisambiguationScore {
  const warnings: string[] = []

  // Calculate individual factor scores
  const nameScore = calculateNameScore(target.name, candidate.name)
  const locationScore = calculateLocationScore(
    target.city,
    target.state,
    candidate.city,
    candidate.state
  )
  const employerScore = calculateEmployerScore(target.employer, candidate.employer)
  const titleScore = calculateTitleScore(target.title, candidate.title)

  // Name is critical - if it doesn't match, nothing else matters
  if (nameScore === 0) {
    return {
      overallScore: 0,
      confidence: "VERY_LOW",
      factors: {
        nameMatch: 0,
        locationMatch: locationScore,
        employerMatch: employerScore,
        titleMatch: titleScore,
      },
      isLikelyMatch: false,
      warnings: ["Name does not match"],
    }
  }

  // Calculate weighted overall score
  // Name: 50%, Location: 25%, Employer: 15%, Title: 10%
  const overallScore =
    nameScore * 0.5 + locationScore * 0.25 + employerScore * 0.15 + titleScore * 0.1

  // Generate warnings
  if (locationScore < 0.3 && target.state && candidate.state) {
    const targetStateNorm = normalizeState(target.state)
    const candidateStateNorm = normalizeState(candidate.state)
    if (targetStateNorm !== candidateStateNorm) {
      warnings.push(`State mismatch: target=${target.state}, candidate=${candidate.state}`)
    }
  }

  if (nameScore < 0.8) {
    warnings.push(`Name is a partial match (score: ${nameScore.toFixed(2)})`)
  }

  // Determine confidence level
  let confidence: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW"
  if (overallScore >= 0.8) {
    confidence = "HIGH"
  } else if (overallScore >= 0.6) {
    confidence = "MEDIUM"
  } else if (overallScore >= 0.4) {
    confidence = "LOW"
  } else {
    confidence = "VERY_LOW"
  }

  // Is this likely the same person?
  const isLikelyMatch = overallScore >= 0.5 && nameScore >= 0.7

  return {
    overallScore,
    confidence,
    factors: {
      nameMatch: nameScore,
      locationMatch: locationScore,
      employerMatch: employerScore,
      titleMatch: titleScore,
    },
    isLikelyMatch,
    warnings,
  }
}

/**
 * Score multiple candidates and return the best match
 */
export function findBestMatch(
  target: PersonContext,
  candidates: MatchCandidate[]
): { best: MatchCandidate | null; score: DisambiguationScore | null; alternatives: Array<{ candidate: MatchCandidate; score: DisambiguationScore }> } {
  if (candidates.length === 0) {
    return { best: null, score: null, alternatives: [] }
  }

  const scored = candidates.map((candidate) => ({
    candidate,
    score: calculateDisambiguationScore(target, candidate),
  }))

  // Sort by overall score descending
  scored.sort((a, b) => b.score.overallScore - a.score.overallScore)

  const best = scored[0]
  const alternatives = scored.slice(1).filter((s) => s.score.isLikelyMatch)

  return {
    best: best.score.isLikelyMatch ? best.candidate : null,
    score: best.score.isLikelyMatch ? best.score : null,
    alternatives,
  }
}

/**
 * Check if a name is too common for reliable disambiguation
 */
export function isCommonName(name: string): boolean {
  const commonFirstNames = new Set([
    "john", "james", "robert", "michael", "david", "william", "richard",
    "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan"
  ])

  const commonLastNames = new Set([
    "smith", "johnson", "williams", "brown", "jones", "garcia", "miller",
    "davis", "rodriguez", "martinez", "hernandez", "lopez", "wilson", "anderson"
  ])

  const parsed = parseName(name)
  const isCommonFirst = commonFirstNames.has(parsed.first)
  const isCommonLast = commonLastNames.has(parsed.last)

  return isCommonFirst && isCommonLast
}

/**
 * Get disambiguation warnings for a prospect
 */
export function getDisambiguationWarnings(context: PersonContext): string[] {
  const warnings: string[] = []

  if (isCommonName(context.name)) {
    warnings.push("⚠️ Common name - verification results may include multiple people with same name")
  }

  if (!context.state) {
    warnings.push("ℹ️ No state provided - location matching disabled")
  }

  if (!context.employer) {
    warnings.push("ℹ️ No employer provided - employer matching disabled")
  }

  return warnings
}
