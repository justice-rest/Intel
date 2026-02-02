/**
 * Batch Export API
 * GET: Export batch job results as CSV, JSON, or PDF
 *
 * Query params:
 * - format: "csv" | "json" | "pdf" (default: csv)
 * - include_reports: "true" to include full report content (csv/json only)
 * - item_index: index of specific item for PDF export (required for pdf format)
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Tables } from "@/app/types/database.types"
import type { BatchProspectJob, BatchProspectItem } from "@/lib/batch-processing"
import {
  generateProspectPdf,
  batchItemToReportData,
  isPdfGenerationAvailable,
} from "@/lib/prospect-pdf"
import { toBrandingSettings, type BrandingSettings } from "@/lib/pdf-branding"
import { hasPaidPlan, isAutumnEnabled } from "@/lib/subscription/autumn-client"

export const runtime = "nodejs"
export const maxDuration = 60 // Allow up to 60s for PDF generation

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "csv"
    const includeFullReports = searchParams.get("include_reports") === "true"

    // Fetch job (using type assertion since table is added via migration)
    const { data: job, error: jobError } = await (supabase as any)
      .from("batch_prospect_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single() as { data: BatchProspectJob | null; error: any }

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      )
    }

    // Parse additional options
    const includeAll = searchParams.get("include_all") === "true" // Include failed/pending items

    // Fetch items based on filter (using type assertion since table is added via migration)
    let itemsQuery = (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .order("item_index", { ascending: true })

    // By default, only export completed items
    if (!includeAll) {
      itemsQuery = itemsQuery.eq("status", "completed")
    }

    const { data: items, error: itemsError } = await itemsQuery as { data: BatchProspectItem[] | null; error: any }

    if (itemsError) {
      return NextResponse.json(
        { error: `Failed to fetch items: ${itemsError.message}` },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          error: "No items to export",
          message: includeAll
            ? "No items found in this batch job"
            : "No completed items to export. Process some prospects first or use ?include_all=true to export all items.",
          job_status: job.status,
          total_prospects: job.total_prospects,
          completed_count: job.completed_count,
        },
        { status: 400 }
      )
    }

    // Calculate export stats for partial exports
    const completedItems = items.filter(i => i.status === "completed")
    const failedItems = items.filter(i => i.status === "failed")
    const pendingItems = items.filter(i => i.status === "pending" || i.status === "processing")

    console.log(`[BatchExport] Exporting ${items.length} items (${completedItems.length} completed, ${failedItems.length} failed, ${pendingItems.length} pending)`)

    // Generate CSV
    if (format === "csv") {
      const headers = [
        "Index",
        "Full Name",
        "First Name",
        "Last Name",
        "Address",
        "City",
        "State",
        "ZIP",
        "RōmyScore",
        "Score Tier",
        "Capacity Rating",
        "Est. Net Worth",
        "Est. Gift Capacity",
        "Recommended Ask",
        "Status",
        ...(includeFullReports ? ["Full Report"] : []),
      ]

      const rows = items.map((item) => {
        const row = [
          item.item_index + 1,
          item.input_data?.name || item.prospect_name || "",
          item.input_data?.first_name || item.prospect_first_name || "",
          item.input_data?.last_name || item.prospect_last_name || "",
          item.input_data?.address || item.input_data?.full_address || "",
          item.input_data?.city || "",
          item.input_data?.state || "",
          item.input_data?.zip || "",
          item.romy_score ?? "",
          item.romy_score_tier || "",
          item.capacity_rating || "",
          item.estimated_net_worth || "",
          item.estimated_gift_capacity || "",
          item.recommended_ask || "",
          item.status,
        ]

        if (includeFullReports) {
          // Escape quotes and newlines for CSV
          const escapedReport = (item.report_content || "")
            .replace(/"/g, '""')
            .replace(/\n/g, "\\n")
          row.push(`"${escapedReport}"`)
        }

        return row
      })

      // Build CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => {
            // Handle values that need quoting
            const str = String(cell)
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }).join(",")
        ),
      ].join("\n")

      // Return CSV file
      const fileName = `${job.name.replace(/[^a-z0-9]/gi, "_")}_export_${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      })
    }

    // JSON format
    if (format === "json") {
      const exportData = {
        job: {
          id: job.id,
          name: job.name,
          created_at: job.created_at,
          completed_at: job.completed_at,
          total_prospects: job.total_prospects,
          completed_count: job.completed_count,
          failed_count: job.failed_count,
        },
        prospects: items.map((item) => ({
          index: item.item_index + 1,
          full_name: item.input_data?.name || item.prospect_name,
          first_name: item.input_data?.first_name || item.prospect_first_name,
          last_name: item.input_data?.last_name || item.prospect_last_name,
          address: item.input_data?.address || item.input_data?.full_address,
          city: item.input_data?.city,
          state: item.input_data?.state,
          zip: item.input_data?.zip,
          romy_score: item.romy_score,
          romy_score_tier: item.romy_score_tier,
          capacity_rating: item.capacity_rating,
          estimated_net_worth: item.estimated_net_worth,
          estimated_gift_capacity: item.estimated_gift_capacity,
          recommended_ask: item.recommended_ask,
          ...(includeFullReports ? { report: item.report_content } : {}),
        })),
      }

      const fileName = `${job.name.replace(/[^a-z0-9]/gi, "_")}_export_${new Date().toISOString().split("T")[0]}.json`

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      })
    }

    // PDF format - exports single prospect as PDF
    if (format === "pdf") {
      // Check if PDF generation is available
      const pdfAvailable = await isPdfGenerationAvailable()
      if (!pdfAvailable) {
        return NextResponse.json(
          {
            error: "PDF generation not available",
            message: "Puppeteer/Chromium not installed on server",
          },
          { status: 503 }
        )
      }

      // Get item index from query params
      const itemIndexStr = searchParams.get("item_index")
      if (!itemIndexStr) {
        return NextResponse.json(
          {
            error: "item_index required for PDF export",
            message: "Specify ?format=pdf&item_index=0 to export a specific prospect",
          },
          { status: 400 }
        )
      }

      const itemIndex = parseInt(itemIndexStr, 10)
      const targetItem = items.find((item) => item.item_index === itemIndex)

      if (!targetItem) {
        return NextResponse.json(
          {
            error: `Item not found at index ${itemIndex}`,
            available_indices: items.map((i) => i.item_index),
          },
          { status: 404 }
        )
      }

      // Fetch user's custom branding settings (only for Pro/Scale users)
      let branding: BrandingSettings | undefined
      try {
        // Only fetch branding if user has Pro/Scale plan
        // Downgraded users get default branding
        const hasAccess = isAutumnEnabled() ? await hasPaidPlan(user.id) : true

        if (hasAccess) {
          const { data: brandingData } = await supabase
            .from("pdf_branding")
            .select("*")
            .eq("user_id", user.id)
            .single() as { data: Tables<"pdf_branding"> | null; error: any }

          if (brandingData) {
            branding = toBrandingSettings({
              id: brandingData.id,
              userId: brandingData.user_id,
              primaryColor: brandingData.primary_color,
              accentColor: brandingData.accent_color,
              logoUrl: brandingData.logo_url,
              logoBase64: brandingData.logo_base64,
              logoContentType: brandingData.logo_content_type,
              hideDefaultFooter: brandingData.hide_default_footer,
              customFooterText: brandingData.custom_footer_text,
              createdAt: brandingData.created_at,
              updatedAt: brandingData.updated_at,
            })
          }
        } else {
          console.log("[BatchExport] User does not have Pro/Scale plan, using default branding")
        }
      } catch {
        // No branding settings found, use defaults
        console.log("[BatchExport] No custom branding found, using defaults")
      }

      // Convert batch item to PDF report data
      const reportData = batchItemToReportData(targetItem, job.name)

      // Generate PDF
      console.log(`[BatchExport] Generating PDF for: ${targetItem.input_data?.name}${branding ? " (with custom branding)" : ""}`)
      const startTime = Date.now()

      const { buffer, filename } = await generateProspectPdf({
        data: reportData,
        format: "Letter",
        printBackground: true,
        branding,
      })

      const duration = Date.now() - startTime
      console.log(`[BatchExport] PDF generated in ${duration}ms, size: ${buffer.length} bytes`)

      // Convert Buffer to ArrayBuffer for TypeScript 5.x compatibility
      // Node.js Buffer always uses ArrayBuffer (not SharedArrayBuffer), so cast is safe
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      const blob = new Blob([arrayBuffer], { type: "application/pdf" })
      return new NextResponse(blob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "no-store",
        },
      })
    }

    return NextResponse.json(
      { error: "Unsupported format. Use 'csv', 'json', or 'pdf'" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[BatchExport] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    )
  }
}
