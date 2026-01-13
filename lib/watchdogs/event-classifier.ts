/**
 * Event Classifier - AI-powered event classification
 * Uses keyword pre-filtering for fast classification, with AI fallback
 */

import type {
  RawNewsArticle,
  ClassifiedEvent,
  EventCategory,
  EventSeverity,
} from "./types"
import { CATEGORY_KEYWORDS, SEVERITY_KEYWORDS } from "./config"

/**
 * Pre-classify an article using keyword matching (fast, no AI call)
 * Returns null for category if no strong match
 */
function preClassify(article: RawNewsArticle): {
  category: EventCategory | null
  severity: EventSeverity
  confidence: number
} {
  const text = `${article.title} ${article.description}`.toLowerCase()

  // Check category
  let bestCategory: EventCategory | null = null
  let maxScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw.toLowerCase())).length
    if (score > maxScore) {
      maxScore = score
      bestCategory = category as EventCategory
    }
  }

  // Calculate confidence based on keyword matches
  const confidence = Math.min(maxScore / 3, 1) // 3+ keywords = high confidence

  // Check severity (in priority order)
  let severity: EventSeverity = "low"
  for (const [sev, keywords] of Object.entries(SEVERITY_KEYWORDS) as [EventSeverity, string[]][]) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      severity = sev
      break
    }
  }

  return {
    category: confidence > 0.3 ? bestCategory : null, // Only use if somewhat confident
    severity,
    confidence,
  }
}

/**
 * Extract entities (companies, countries, people) from text
 */
function extractEntities(article: RawNewsArticle): string[] {
  const entities: Set<string> = new Set()

  // Add any stock symbols
  if (article.symbols) {
    article.symbols.forEach((s) => entities.add(s))
  }

  // Extract capitalized words that might be entities
  const text = `${article.title} ${article.description}`
  const words = text.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) || []

  // Filter out common words and keep likely entities
  const commonWords = new Set([
    "The", "This", "That", "These", "Those", "And", "But", "For", "With",
    "From", "Into", "About", "After", "Before", "During", "Under", "Over",
    "Between", "Through", "Against", "Within", "Without", "According",
    "However", "Meanwhile", "Although", "Because", "Therefore", "Moreover",
    "Furthermore", "Additionally", "Breaking", "Update", "Report", "News",
  ])

  words.forEach((word) => {
    if (!commonWords.has(word) && word.length > 2) {
      entities.add(word)
    }
  })

  return Array.from(entities).slice(0, 10) // Limit to 10 entities
}

/**
 * Generate a summary from the article
 */
function generateSummary(article: RawNewsArticle, category: EventCategory): string {
  // Use description if short enough, otherwise truncate title
  if (article.description && article.description.length <= 200) {
    return article.description
  }

  if (article.description) {
    // Find first sentence
    const firstSentence = article.description.split(/[.!?]/)[0]
    if (firstSentence && firstSentence.length > 20) {
      return firstSentence + "."
    }
  }

  // Fall back to title
  return article.title
}

/**
 * Generate impact prediction based on category and severity
 */
function generateImpactPrediction(
  category: EventCategory,
  severity: EventSeverity,
  entities: string[]
): string {
  const impactTemplates: Record<EventCategory, Record<EventSeverity, string>> = {
    financial: {
      critical: "Major market disruption expected. Trading volumes may surge significantly.",
      high: "Significant market movement likely. Investors should monitor closely.",
      medium: "Moderate market impact expected. Sector-specific effects possible.",
      low: "Limited market impact. Routine market activity expected.",
    },
    geopolitical: {
      critical: "Critical geopolitical situation. Global markets and supply chains at risk.",
      high: "Elevated geopolitical tensions. Regional stability concerns.",
      medium: "Diplomatic developments ongoing. Monitoring recommended.",
      low: "Standard diplomatic activity. Limited broader impact.",
    },
    natural: {
      critical: "Severe natural disaster. Emergency response activated. Major infrastructure risk.",
      high: "Significant natural event. Evacuations or damage likely.",
      medium: "Notable weather or geological activity. Precautions advised.",
      low: "Minor environmental event. No significant impact expected.",
    },
    regulatory: {
      critical: "Major regulatory action. Industry-wide compliance changes required.",
      high: "Significant policy change. Affected sectors should prepare.",
      medium: "New regulatory guidance. Review and adaptation recommended.",
      low: "Routine regulatory update. Standard compliance review.",
    },
  }

  let prediction = impactTemplates[category][severity]

  // Add entity-specific context if available
  if (entities.length > 0) {
    const topEntities = entities.slice(0, 2).join(" and ")
    prediction += ` Involves ${topEntities}.`
  }

  return prediction
}

/**
 * Classify events using keyword matching
 * In production, ambiguous articles would be sent to AI for classification
 */
export async function classifyEvents(
  articles: RawNewsArticle[]
): Promise<ClassifiedEvent[]> {
  const results: ClassifiedEvent[] = []

  for (const article of articles) {
    // Pre-classify with keywords
    const { category, severity, confidence } = preClassify(article)

    // If no category detected, default to financial (most common)
    const finalCategory: EventCategory = category || "financial"

    // Extract entities
    const entities = extractEntities(article)

    // Generate summary and impact prediction
    const summary = generateSummary(article, finalCategory)
    const impactPrediction = generateImpactPrediction(finalCategory, severity, entities)

    // Determine if alert should be generated
    const alertGenerated = severity === "critical"

    results.push({
      id: article.id,
      rawArticle: article,
      category: finalCategory,
      severity,
      summary,
      impactPrediction,
      entities,
      classifiedAt: new Date().toISOString(),
      alertGenerated,
      dismissed: false,
    })
  }

  return results
}

/**
 * AI classification endpoint (for ambiguous articles)
 * Would call /api/watchdogs/classify in production
 */
export async function aiClassify(articles: RawNewsArticle[]): Promise<ClassifiedEvent[]> {
  try {
    const response = await fetch("/api/watchdogs/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
    })

    if (!response.ok) {
      throw new Error("Classification failed")
    }

    return response.json()
  } catch (error) {
    console.error("[EventClassifier] AI classification failed:", error)
    // Fallback to keyword-only classification
    return classifyEvents(articles)
  }
}
