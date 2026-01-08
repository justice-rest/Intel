import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai"
import type {
  RawNewsArticle,
  ClassifiedEvent,
  EventCategory,
  EventSeverity,
} from "@/lib/watchdogs/types"
import {
  CATEGORY_KEYWORDS,
  SEVERITY_KEYWORDS,
  AI_CONFIG,
} from "@/lib/watchdogs/config"

export const maxDuration = 60 // Allow longer for AI processing

// Request body schema
interface ClassifyRequest {
  articles: RawNewsArticle[]
  useAI?: boolean // Default true, can disable for testing
}

// Keyword-based pre-classification (fast, no API call)
function keywordClassify(article: RawNewsArticle): {
  category: EventCategory
  severity: EventSeverity
  confidence: number
} {
  const text = `${article.title} ${article.description}`.toLowerCase()

  // Find best category match
  let bestCategory: EventCategory = "financial"
  let maxScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw.toLowerCase())).length
    if (score > maxScore) {
      maxScore = score
      bestCategory = category as EventCategory
    }
  }

  // Find severity
  let severity: EventSeverity = "low"
  for (const [sev, keywords] of Object.entries(SEVERITY_KEYWORDS) as [EventSeverity, string[]][]) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      severity = sev
      break
    }
  }

  return {
    category: bestCategory,
    severity,
    confidence: Math.min(maxScore / 3, 1),
  }
}

// Extract entities from article
function extractEntities(article: RawNewsArticle): string[] {
  const entities: Set<string> = new Set()

  if (article.symbols) {
    article.symbols.forEach((s) => entities.add(s))
  }

  const text = `${article.title} ${article.description}`
  const words = text.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) || []

  const commonWords = new Set([
    "The", "This", "That", "These", "Those", "And", "But", "For", "With",
    "From", "Into", "About", "After", "Before", "During", "Under", "Over",
    "However", "Meanwhile", "Although", "Because", "Therefore", "Moreover",
    "Breaking", "Update", "Report", "News", "According",
  ])

  words.forEach((word) => {
    if (!commonWords.has(word) && word.length > 2) {
      entities.add(word)
    }
  })

  return Array.from(entities).slice(0, 10)
}

// AI classification using Grok 4.1 Fast
async function classifyWithGrok(
  articles: RawNewsArticle[],
  apiKey: string
): Promise<Map<string, { category: EventCategory; severity: EventSeverity; summary: string; impact: string }>> {
  const results = new Map<string, { category: EventCategory; severity: EventSeverity; summary: string; impact: string }>()

  if (articles.length === 0) return results

  // Build prompt for batch classification
  const articlesText = articles.map((a, i) =>
    `[${i + 1}] ${a.title}\n${a.description || "No description"}`
  ).join("\n\n")

  const prompt = `You are an intelligence analyst classifying news articles. For each article, provide:
1. Category: one of "financial", "geopolitical", "natural", "regulatory"
2. Severity: one of "critical", "high", "medium", "low"
3. Summary: A brief 1-2 sentence summary
4. Impact: A brief market/policy impact prediction

Classify these articles:

${articlesText}

Respond in JSON format:
{
  "classifications": [
    {
      "index": 1,
      "category": "financial",
      "severity": "medium",
      "summary": "...",
      "impact": "..."
    }
  ]
}

Only include the JSON, no other text.`

  try {
    const openrouter = createOpenRouter({
      apiKey,
    })

    const { text } = await generateText({
      model: openrouter.chat(AI_CONFIG.model),
      prompt,
      maxTokens: 2000,
    })

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      if (parsed.classifications && Array.isArray(parsed.classifications)) {
        for (const classification of parsed.classifications) {
          const index = classification.index - 1
          if (index >= 0 && index < articles.length) {
            const article = articles[index]
            results.set(article.id, {
              category: classification.category as EventCategory,
              severity: classification.severity as EventSeverity,
              summary: classification.summary || article.title,
              impact: classification.impact || "Impact analysis pending.",
            })
          }
        }
      }
    }
  } catch (error) {
    console.error("[Watchdogs AI] Grok classification error:", error)
    // Fallback handled by caller
  }

  return results
}

// Generate impact prediction (fallback)
function generateImpactPrediction(
  category: EventCategory,
  severity: EventSeverity
): string {
  const impacts: Record<EventCategory, Record<EventSeverity, string>> = {
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

  return impacts[category][severity]
}

// Generate summary (fallback)
function generateSummary(article: RawNewsArticle): string {
  if (article.description && article.description.length <= 200) {
    return article.description
  }

  if (article.description) {
    const firstSentence = article.description.split(/[.!?]/)[0]
    if (firstSentence && firstSentence.length > 20) {
      return firstSentence + "."
    }
  }

  return article.title
}

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request
    const body: ClassifyRequest = await request.json()

    if (!body.articles || !Array.isArray(body.articles)) {
      return NextResponse.json(
        { error: "Invalid request: articles array required" },
        { status: 400 }
      )
    }

    // Limit batch size
    const articles = body.articles.slice(0, AI_CONFIG.maxBatchSize)
    const useAI = body.useAI !== false // Default to true

    // Get OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY

    // Try AI classification if enabled and API key available
    let aiResults = new Map<string, { category: EventCategory; severity: EventSeverity; summary: string; impact: string }>()

    if (useAI && apiKey) {
      // Filter articles with low keyword confidence for AI classification
      const needsAI = articles.filter((article) => {
        const { confidence } = keywordClassify(article)
        return confidence < 0.6 // Only use AI for ambiguous articles
      })

      if (needsAI.length > 0) {
        console.log(`[Watchdogs AI] Classifying ${needsAI.length} articles with Grok`)
        aiResults = await classifyWithGrok(needsAI, apiKey)
      }
    }

    // Classify each article
    const classifiedEvents: ClassifiedEvent[] = articles.map((article) => {
      // Check if AI classified this article
      const aiResult = aiResults.get(article.id)

      if (aiResult) {
        return {
          id: article.id,
          rawArticle: article,
          category: aiResult.category,
          severity: aiResult.severity,
          summary: aiResult.summary,
          impactPrediction: aiResult.impact,
          entities: extractEntities(article),
          classifiedAt: new Date().toISOString(),
          alertGenerated: aiResult.severity === "critical",
          dismissed: false,
          classifiedBy: "grok" as const,
        }
      }

      // Fallback to keyword classification
      const { category, severity } = keywordClassify(article)
      const entities = extractEntities(article)
      const summary = generateSummary(article)
      const impactPrediction = generateImpactPrediction(category, severity)

      return {
        id: article.id,
        rawArticle: article,
        category,
        severity,
        summary,
        impactPrediction,
        entities,
        classifiedAt: new Date().toISOString(),
        alertGenerated: severity === "critical",
        dismissed: false,
        classifiedBy: "keywords" as const,
      }
    })

    return NextResponse.json({
      events: classifiedEvents,
      stats: {
        total: classifiedEvents.length,
        aiClassified: aiResults.size,
        keywordClassified: classifiedEvents.length - aiResults.size,
      }
    })
  } catch (error) {
    console.error("[Watchdogs API] Classification error:", error)
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    )
  }
}
