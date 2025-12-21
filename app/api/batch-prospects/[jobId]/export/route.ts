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
import type { BatchProspectJob, BatchProspectItem } from "@/lib/batch-processing"
import {
  generateProspectPdf,
  batchItemToReportData,
  isPdfGenerationAvailable,
} from "@/lib/prospect-pdf"

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

    // Fetch completed items (using type assertion since table is added via migration)
    const { data: items, error: itemsError } = await (supabase as any)
      .from("batch_prospect_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "completed")
      .order("item_index", { ascending: true }) as { data: BatchProspectItem[] | null; error: any }

    if (itemsError) {
      return NextResponse.json(
        { error: `Failed to fetch items: ${itemsError.message}` },
        { status: 500 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No completed items to export" },
        { status: 400 }
      )
    }

    // Generate CSV
    if (format === "csv") {
      const headers = [
        "Index",
        "Name",
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
          item.input_data?.name || "",
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
          name: item.input_data?.name,
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

      // Convert batch item to PDF report data
      const reportData = batchItemToReportData(targetItem, job.name)

      // Generate PDF
      console.log(`[BatchExport] Generating PDF for: ${targetItem.input_data?.name}`)
      const startTime = Date.now()

      const { buffer, filename } = await generateProspectPdf({
        data: reportData,
        format: "Letter",
        printBackground: true,
      })

      const duration = Date.now() - startTime
      console.log(`[BatchExport] PDF generated in ${duration}ms, size: ${buffer.length} bytes`)

      return new NextResponse(buffer, {
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
