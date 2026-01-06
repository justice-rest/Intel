/**
 * Prospect PDF Export API
 *
 * POST: Generate a PDF from prospect report data
 *
 * Request body: ProspectReportData (see lib/prospect-pdf/template.ts)
 * Response: PDF file download
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateProspectPdf,
  isPdfGenerationAvailable,
  type ProspectReportData,
} from "@/lib/prospect-pdf"

export const runtime = "nodejs"
export const maxDuration = 60 // Allow up to 60s for PDF generation

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient()
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Check if PDF generation is available
    const isAvailable = await isPdfGenerationAvailable()
    if (!isAvailable) {
      return NextResponse.json(
        {
          error: "PDF generation not available",
          message:
            "Puppeteer/Chromium not installed. Install with: npm install puppeteer-core @sparticuz/chromium",
        },
        { status: 503 }
      )
    }

    // Parse request body
    const body = await request.json()
    const data = body as ProspectReportData

    // Validate required fields
    if (!data.prospectName) {
      return NextResponse.json(
        { error: "Missing required field: prospectName" },
        { status: 400 }
      )
    }

    // Set defaults for missing fields
    const reportData: ProspectReportData = {
      ...data,
      prospectName: data.prospectName,
      location: data.location || "Location not provided",
      reportDate:
        data.reportDate ||
        new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      executiveSummary: data.executiveSummary || "No executive summary provided.",
      personal: data.personal || {
        fullName: data.prospectName,
      },
      professional: data.professional || {},
      realEstate: data.realEstate || {},
      businessInterests: data.businessInterests || {},
      otherAssets: data.otherAssets || {},
      lifestyleIndicators: data.lifestyleIndicators || {},
      philanthropic: data.philanthropic || {},
      givingCapacity: data.givingCapacity || {
        recommendedAskRange: "Not assessed",
      },
      engagement: data.engagement || {},
      summary: data.summary || {},
    }

    // Generate PDF
    console.log(`[ProspectPDF] Generating PDF for: ${data.prospectName}`)
    const startTime = Date.now()

    const { buffer, filename } = await generateProspectPdf({
      data: reportData,
      format: "Letter",
      printBackground: true,
    })

    const duration = Date.now() - startTime
    console.log(
      `[ProspectPDF] PDF generated in ${duration}ms, size: ${buffer.length} bytes`
    )

    // Return PDF as download
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
  } catch (error) {
    console.error("[ProspectPDF] Error:", error)
    return NextResponse.json(
      {
        error: "PDF generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * GET: Check PDF generation availability
 */
export async function GET() {
  try {
    const isAvailable = await isPdfGenerationAvailable()

    return NextResponse.json({
      available: isAvailable,
      message: isAvailable
        ? "PDF generation is available"
        : "Puppeteer/Chromium not installed",
    })
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
