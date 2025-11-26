import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getDocument } from "@/lib/rag"
import { getCustomerData, normalizePlanId } from "@/lib/subscription/autumn-client"

/**
 * GET /api/rag/download/[id]
 * Get a signed URL for downloading a document
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const documentId = params.id

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
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

    // Check if user has Scale plan
    const customerData = await getCustomerData(user.id)
    const currentProductId = customerData?.products?.[0]?.id
    const planType = normalizePlanId(currentProductId)

    if (planType !== "scale") {
      return NextResponse.json(
        { error: "Scale plan required for RAG features" },
        { status: 403 }
      )
    }

    // Get document to verify ownership
    const document = await getDocument(documentId, user.id)

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Extract file path from URL
    const url = new URL(document.file_url)
    const pathMatch = url.pathname.match(/\/rag-documents\/(.+)/)

    if (!pathMatch) {
      return NextResponse.json(
        { error: "Invalid document URL" },
        { status: 500 }
      )
    }

    const filePath = pathMatch[1]

    // Create signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("rag-documents")
        .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedUrlError) {
      throw new Error(`Failed to create signed URL: ${signedUrlError.message}`)
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      fileName: document.file_name,
      expiresIn: 3600,
    })
  } catch (error) {
    console.error("Download document error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to download document",
      },
      { status: 500 }
    )
  }
}
