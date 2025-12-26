import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  searchDocumentChunks,
  generateEmbedding,
  RAG_MAX_RESULTS,
  RAG_SIMILARITY_THRESHOLD,
} from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

/**
 * POST /api/rag/search
 * Search for similar document chunks using vector similarity
 */
export async function POST(request: Request) {
  try {
    const { query, documentIds, maxResults, similarityThreshold } =
      await request.json()

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has Scale plan (use higher timeout - RAG is not latency-critical)
    const customerData = await getCustomerData(user.id, 5000)
    const currentProductId = customerData?.products?.[0]?.id
    const planType = normalizePlanId(currentProductId)

    if (planType !== "scale") {
      return NextResponse.json(
        { error: "Scale plan required for RAG features" },
        { status: 403 }
      )
    }

    // Get OpenRouter API key
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (!openrouterKey) {
      throw new Error("OpenRouter API key not configured")
    }

    // Generate embedding for the query
    const embeddingResponse = await generateEmbedding(query, openrouterKey)

    // Search for similar chunks
    const results = await searchDocumentChunks(
      embeddingResponse.embedding,
      user.id,
      {
        maxResults: maxResults || RAG_MAX_RESULTS,
        similarityThreshold: similarityThreshold || RAG_SIMILARITY_THRESHOLD,
        documentIds: documentIds || null,
      }
    )

    return NextResponse.json({
      results,
      query,
      resultsCount: results.length,
    })
  } catch (error) {
    console.error("RAG search error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search documents",
      },
      { status: 500 }
    )
  }
}
