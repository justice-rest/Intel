/**
 * Prospect PDF Export API
 *
 * POST: Generate a PDF from prospect report data
 *
 * Request body: ProspectReportData (see lib/prospect-pdf/template.ts)
 * Response: PDF file download
 *
 * Supports custom branding for Pro/Scale users (colors, logo, footer)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  generateProspectPdf,
  isPdfGenerationAvailable,
  type ProspectReportData,
} from "@/lib/prospect-pdf"
import { toBrandingSettings, type BrandingSettings } from "@/lib/pdf-branding"
import { hasPaidPlan, isAutumnEnabled } from "@/lib/subscription/autumn-client"

export const runtime = "nodejs"
export const maxDuration = 60 // Allow up to 60s for PDF generation

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient()
    let userId: string | null = null
    let branding: BrandingSettings | undefined

    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      userId = user.id

      // Only fetch branding if user has Pro/Scale plan
      // Downgraded users get default branding
      const hasAccess = isAutumnEnabled() ? await hasPaidPlan(user.id) : true

      if (hasAccess) {
        // Fetch user's custom branding settings
        const { data: brandingData, error: brandingError } = await supabase
          .from("pdf_branding")
          .select("*")
          .eq("user_id", user.id)
          .single() as { data: any; error: any }

        if (brandingError) {
          if (brandingError.code === "PGRST116") {
            // No branding record exists - this is expected for new users
            console.log("[ProspectPDF] No custom branding found for user, using defaults")
          } else {
            // Actual error - log it but continue with defaults
            console.error("[ProspectPDF] Error fetching branding:", brandingError)
          }
        } else if (brandingData) {
          console.log("[ProspectPDF] Found custom branding:", {
            primaryColor: brandingData.primary_color,
            accentColor: brandingData.accent_color,
            hasLogo: !!brandingData.logo_base64,
            hideDefaultFooter: brandingData.hide_default_footer,
            customFooterText: brandingData.custom_footer_text?.substring(0, 20),
          })
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
        console.log("[ProspectPDF] User does not have Pro/Scale plan, using default branding")
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
    console.log(`[ProspectPDF] Generating PDF for: ${data.prospectName}${branding ? " (with custom branding)" : ""}`)
    const startTime = Date.now()

    const { buffer, filename } = await generateProspectPdf({
      data: reportData,
      format: "Letter",
      printBackground: true,
      branding,
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
