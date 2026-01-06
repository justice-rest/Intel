/**
 * Prospect Report PDF Template
 *
 * Generates HTML matching the pdf.html design for PDF export.
 * Supports custom branding (colors, logo, footer) for Pro/Scale users.
 */

import fs from "fs"
import path from "path"
import {
  type BrandingSettings,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
} from "@/lib/pdf-branding"

// Re-export BrandingSettings for convenience
export type { BrandingSettings } from "@/lib/pdf-branding"

// ============================================================================
// TYPES
// ============================================================================

export interface ProspectReportData {
  // Header info
  prospectName: string
  location: string
  reportDate: string
  preparedFor?: string

  // Executive Summary
  executiveSummary: string

  // Personal Background
  personal: {
    fullName: string
    currentLocation?: string
    ageBirthYear?: string
    contactInfo?: string
    familyStatus?: string
    primaryResidence?: string
  }
  personalBackground?: string
  spouseInfo?: string

  // Professional Background
  professional: {
    currentPositions?: string
    careerTrajectory?: string
    education?: string
    expertiseCredentials?: string
    professionalNetwork?: string
    currentInterests?: string
  }
  spouseProfessional?: {
    currentRole?: string
    background?: string
    education?: string
    communityInvolvement?: string
    roleInPhilanthropy?: string
  }

  // Wealth Indicators
  realEstate: {
    primaryResidence?: string
    additionalProperties?: string
    historicalRealEstate?: string
  }
  businessInterests: {
    currentEquity?: string
    businessIncome?: string
    startupVentures?: string
  }
  otherAssets: {
    investmentAccounts?: string
    additionalIncome?: string
    debtLiabilities?: string
  }
  lifestyleIndicators: {
    spendingPatterns?: string
    livingCosts?: string
    netWorthAssessment?: string
  }

  // Philanthropic
  philanthropic: {
    givingVehicle?: string
    taxStrategy?: string
    annualVolume?: {
      documented?: string
      estimated?: string
    }
    documentedInterests?: string
    givingPatterns?: string
    potentialInterests?: string
    philosophy?: {
      motivations?: string
      preferences?: string
      valuesAlignment?: string
    }
  }

  // Giving Capacity
  givingCapacity: {
    recommendedAskRange: string
    singleGift?: string
    fiveYearPledge?: string
    annualCapacity?: string
    basis?: string
  }

  // Engagement Strategy
  engagement: {
    positioningPoints?: string[]
    phases?: {
      discovery?: string[]
      positioning?: string[]
      solicitation?: string[]
    }
    connectionPoints?: string[]
    guardrails?: string[]
    greenLights?: string[]
    redFlags?: string[]
  }

  // Summary Assessment
  summary: {
    prospectGrade?: string
    priorityLevel?: string
    timelineToSolicitation?: string
    expectedROI?: string
    strategicValue?: string
  }

  // Sources
  sources?: {
    publicRecords?: string[]
    digitalPresence?: string[]
    professionalDatabases?: string[]
    interviews?: string[]
    otherSources?: string[]
  }
  researchLimitations?: string

  // Conclusion
  conclusion?: string
}

// ============================================================================
// LOGO
// ============================================================================

let cachedLogoBase64: string | null = null

/**
 * Get the Rōmy logo as base64 data URI
 */
export function getLogoBase64(): string {
  if (cachedLogoBase64) {
    return cachedLogoBase64
  }

  try {
    const logoPath = path.join(process.cwd(), "public", "BrandmarkRōmy.png")
    const logoBuffer = fs.readFileSync(logoPath)
    cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`
    return cachedLogoBase64
  } catch {
    // Fallback: return a simple placeholder
    console.warn("[ProspectPDF] Could not load logo, using fallback")
    return ""
  }
}

// ============================================================================
// HTML GENERATION
// ============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (!text) return ""
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Convert markdown-style bold to HTML
 */
function formatText(text: string): string {
  if (!text) return ""
  // Convert **bold** to <strong>
  let formatted = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  // Convert newlines to <br>
  formatted = formatted.replace(/\n/g, "<br>")
  return formatted
}

/**
 * Generate the complete HTML document for PDF export
 * Perplexity-style design with clean cards, subtle shadows, and modern typography
 *
 * @param data - Prospect report data
 * @param branding - Optional custom branding settings (colors, logo, footer)
 */
export function generateProspectReportHtml(
  data: ProspectReportData,
  branding?: BrandingSettings
): string {
  // Use custom branding or defaults
  const primaryColor = branding?.primaryColor || DEFAULT_PRIMARY_COLOR
  const accentColor = branding?.accentColor || DEFAULT_ACCENT_COLOR
  const logoBase64 = branding?.logoBase64 || getLogoBase64()
  const hideDefaultFooter = branding?.hideDefaultFooter || false
  const customFooterText = branding?.customFooterText || null

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prospect Profile - ${escapeHtml(data.prospectName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --color-primary: ${escapeHtml(primaryColor)};
            --color-secondary: #475569;
            --color-accent: ${escapeHtml(accentColor)};
            --color-accent-light: #f0f9ff;
            --color-text: #334155;
            --color-muted: #64748b;
            --color-border: #e2e8f0;
            --color-bg: #ffffff;
            --color-card: #f8fafc;
            --color-card-hover: #f1f5f9;
            --base-font-size: 10.5pt;
            --base-line-height: 1.65;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --radius-sm: 6px;
            --radius-md: 10px;
            --radius-lg: 14px;
        }
        * { box-sizing: border-box; }
        html, body {
            font-family: var(--font-body);
            font-size: var(--base-font-size);
            font-weight: 400;
            line-height: var(--base-line-height);
            color: var(--color-text);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            margin: 0;
            padding: 0;
        }
        body {
            max-width: 7.5in;
            margin: 0 auto;
            padding: 0.6in 0.75in;
            background: var(--color-bg);
        }

        /* Header - Clean, minimal design */
        .header {
            text-align: center;
            margin-bottom: 2.5em;
            padding-bottom: 1.75em;
            border-bottom: 1px solid var(--color-border);
        }
        .header img {
            height: 32px;
            width: auto;
            display: inline-block;
            margin-bottom: 1.25em;
            object-fit: contain;
        }
        .header .date {
            font-size: 9pt;
            font-weight: 500;
            color: var(--color-muted);
            margin-bottom: 0.75em;
            letter-spacing: 0.02em;
        }
        .header h1 {
            font-size: 26pt;
            font-weight: 700;
            margin: 0 0 0.35em;
            letter-spacing: -0.03em;
            line-height: 1.15;
            color: var(--color-primary);
        }
        .header .subtitle {
            font-size: 10.5pt;
            font-weight: 500;
            color: var(--color-secondary);
            margin: 0;
        }

        /* Section Headers */
        h2 {
            font-size: 13pt;
            font-weight: 700;
            color: var(--color-primary);
            margin: 2em 0 0.85em;
            padding-bottom: 0.5em;
            border-bottom: 2px solid var(--color-accent);
            letter-spacing: -0.01em;
        }
        h3 {
            font-size: 11pt;
            font-weight: 600;
            color: var(--color-primary);
            margin: 1.5em 0 0.6em;
            letter-spacing: -0.01em;
        }

        /* Typography */
        p { margin: 0 0 0.85em; }
        strong { font-weight: 600; color: var(--color-primary); }
        em { font-style: italic; }
        ul { margin: 0.6em 0 1.1em 1.25em; padding: 0; }
        li { margin: 0.4em 0; line-height: 1.55; }

        /* Card - Modern card design with subtle shadow */
        .card {
            background: var(--color-card);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 1.1em 1.25em;
            margin: 1em 0 1.35em;
            box-shadow: var(--shadow-sm);
        }

        /* Info Grid - Two-column metadata layout */
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.85em 1.75em;
            padding: 1.1em 1.25em;
            background: var(--color-card);
            border-radius: var(--radius-md);
            margin: 1em 0 1.5em;
            border: 1px solid var(--color-border);
            box-shadow: var(--shadow-sm);
        }
        .info-grid .item { margin-bottom: 0.15em; }
        .info-grid .label {
            font-size: 8.5pt;
            font-weight: 600;
            color: var(--color-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 0.2em;
        }
        .info-grid .value {
            font-size: 10pt;
            font-weight: 500;
            margin: 0;
            color: var(--color-primary);
        }

        /* Summary Box - Executive summary card */
        .summary-box {
            background: linear-gradient(135deg, var(--color-card) 0%, var(--color-card-hover) 100%);
            padding: 1.25em 1.4em;
            margin: 1em 0 1.75em;
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
            box-shadow: var(--shadow-sm);
        }
        .summary-box p {
            margin: 0;
            line-height: 1.7;
        }

        /* Capacity Callout - Prominent giving capacity display */
        .callout {
            text-align: center;
            padding: 1.5em 1.75em;
            margin: 1.5em 0;
            background: linear-gradient(135deg, var(--color-accent-light) 0%, #f0f9ff 100%);
            border-radius: var(--radius-lg);
            border: 1px solid #bae6fd;
            box-shadow: var(--shadow-md);
        }
        .callout .label {
            font-size: 9pt;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--color-accent);
            letter-spacing: 0.08em;
            margin-bottom: 0.4em;
        }
        .callout .big {
            font-size: 24pt;
            font-weight: 700;
            margin: 0.2em 0;
            color: var(--color-primary);
            letter-spacing: -0.02em;
        }
        .callout .notes {
            margin: 0.6em 0 0;
            color: var(--color-secondary);
            font-size: 9.5pt;
            line-height: 1.6;
        }

        /* Metrics Table - Clean tabular data */
        .metrics-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0 1.5em;
            font-size: 10pt;
        }
        .metrics-table th,
        .metrics-table td {
            padding: 0.65em 0.85em;
            text-align: left;
            border-bottom: 1px solid var(--color-border);
        }
        .metrics-table th {
            font-size: 8.5pt;
            font-weight: 600;
            color: var(--color-muted);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            background: var(--color-card);
        }
        .metrics-table td {
            color: var(--color-text);
        }
        .metrics-table tr:last-child td {
            border-bottom: none;
        }

        /* Source Citation - Inline source markers */
        .source {
            font-size: 8pt;
            color: var(--color-accent);
            font-weight: 500;
            vertical-align: super;
        }

        /* Footer - Clean, minimal */
        .footer {
            margin-top: 3em;
            padding-top: 1.25em;
            border-top: 1px solid var(--color-border);
            font-size: 8.5pt;
            color: var(--color-muted);
            text-align: center;
            line-height: 1.7;
        }
        .footer p {
            margin: 0.4em 0;
        }
        .footer .confidential {
            font-size: 8pt;
            color: #94a3b8;
            margin-top: 0.75em;
        }

        .page-break-before { break-before: page; page-break-before: always; }

        @media print {
            body { padding: 0.4in 0.55in; }
            h1, h2, h3, .summary-box, .callout, .info-grid, .card, ul, .metrics-table {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            h2, h3 { break-after: avoid; }
            p { orphans: 3; widows: 3; }
            a[href]:after { content: ""; }
            .callout {
                box-shadow: none;
                border: 2px solid #bae6fd;
            }
            .card, .info-grid, .summary-box {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Rōmy">` : ""}
        <div class="date">${escapeHtml(data.reportDate)}</div>
        <h1>${escapeHtml(data.prospectName)}</h1>
        <p class="subtitle">${escapeHtml(data.location)}${data.preparedFor ? ` | Prepared for ${escapeHtml(data.preparedFor)}` : ""}</p>
    </div>

    <!-- SECTION 1: EXECUTIVE SUMMARY -->
    <h2>Executive Summary</h2>

    <div class="summary-box">
        <p>${formatText(data.executiveSummary)}</p>
    </div>

    <!-- SECTION 2: PERSONAL BACKGROUND AND CONTACT INFORMATION -->
    <h2>Personal Background</h2>

    <div class="info-grid">
        <div class="item"><div class="label">Name</div><p class="value">${escapeHtml(data.personal.fullName)}</p></div>
        <div class="item"><div class="label">Location</div><p class="value">${escapeHtml(data.personal.currentLocation || "Not available")}</p></div>
        <div class="item"><div class="label">Age / Birth Year</div><p class="value">${escapeHtml(data.personal.ageBirthYear || "Not available")}</p></div>
        <div class="item"><div class="label">Contact</div><p class="value">${escapeHtml(data.personal.contactInfo || "Not available")}</p></div>
        <div class="item"><div class="label">Family Status</div><p class="value">${escapeHtml(data.personal.familyStatus || "Not available")}</p></div>
        <div class="item"><div class="label">Primary Residence</div><p class="value">${escapeHtml(data.personal.primaryResidence || "Not available")}</p></div>
    </div>

    ${
      data.personalBackground
        ? `
    <h3>Personal Background</h3>
    <p>${formatText(data.personalBackground)}</p>
    `
        : ""
    }

    ${
      data.spouseInfo
        ? `
    <h3>Spouse / Life Partner Information</h3>
    <p>${formatText(data.spouseInfo)}</p>
    `
        : ""
    }

    <!-- SECTION 3: PROFESSIONAL BACKGROUND -->
    <h2>Professional Background</h2>

    <h3>Donor/Prospect – Comprehensive Career Profile</h3>

    ${
      data.professional.currentPositions
        ? `<p><strong>Current Position(s):</strong> ${formatText(data.professional.currentPositions)}</p>`
        : ""
    }

    ${
      data.professional.careerTrajectory
        ? `<p><strong>Career Trajectory:</strong> ${formatText(data.professional.careerTrajectory)}</p>`
        : ""
    }

    ${
      data.professional.education
        ? `<p><strong>Education:</strong> ${formatText(data.professional.education)}</p>`
        : ""
    }

    ${
      data.professional.expertiseCredentials
        ? `<p><strong>Expertise & Credentials:</strong> ${formatText(data.professional.expertiseCredentials)}</p>`
        : ""
    }

    ${
      data.professional.professionalNetwork
        ? `<p><strong>Professional Network:</strong> ${formatText(data.professional.professionalNetwork)}</p>`
        : ""
    }

    ${
      data.professional.currentInterests
        ? `<p><strong>Current Strategic Interests:</strong> ${formatText(data.professional.currentInterests)}</p>`
        : ""
    }

    ${
      data.spouseProfessional
        ? `
    <h3>Spouse – Comprehensive Background</h3>

    ${data.spouseProfessional.currentRole ? `<p><strong>Current Role/Career:</strong> ${formatText(data.spouseProfessional.currentRole)}</p>` : ""}

    ${data.spouseProfessional.background ? `<p><strong>Professional Background:</strong> ${formatText(data.spouseProfessional.background)}</p>` : ""}

    ${data.spouseProfessional.education ? `<p><strong>Education:</strong> ${formatText(data.spouseProfessional.education)}</p>` : ""}

    ${data.spouseProfessional.communityInvolvement ? `<p><strong>Community Involvement:</strong> ${formatText(data.spouseProfessional.communityInvolvement)}</p>` : ""}

    ${data.spouseProfessional.roleInPhilanthropy ? `<p><strong>Role in Household Philanthropy:</strong> ${formatText(data.spouseProfessional.roleInPhilanthropy)}</p>` : ""}
    `
        : ""
    }

    <!-- SECTION 4: WEALTH INDICATORS AND ASSET PROFILE -->
    <h2>Wealth Indicators and Asset Profile</h2>

    <h3>Real Estate Holdings</h3>

    ${
      data.realEstate.primaryResidence
        ? `<p><strong>Primary Residence:</strong> ${formatText(data.realEstate.primaryResidence)}</p>`
        : ""
    }

    ${
      data.realEstate.additionalProperties
        ? `<p><strong>Additional Properties:</strong> ${formatText(data.realEstate.additionalProperties)}</p>`
        : ""
    }

    ${
      data.realEstate.historicalRealEstate
        ? `<p><strong>Historical Real Estate:</strong> ${formatText(data.realEstate.historicalRealEstate)}</p>`
        : ""
    }

    <h3>Business Interests and Income</h3>

    ${
      data.businessInterests.currentEquity
        ? `<p><strong>Current Business Equity:</strong> ${formatText(data.businessInterests.currentEquity)}</p>`
        : ""
    }

    ${
      data.businessInterests.businessIncome
        ? `<p><strong>Business Income:</strong> ${formatText(data.businessInterests.businessIncome)}</p>`
        : ""
    }

    ${
      data.businessInterests.startupVentures
        ? `<p><strong>Startup/Growth Stage Ventures:</strong> ${formatText(data.businessInterests.startupVentures)}</p>`
        : ""
    }

    <h3>Other Assets and Income Sources</h3>

    ${
      data.otherAssets.investmentAccounts
        ? `<p><strong>Investment Accounts:</strong> ${formatText(data.otherAssets.investmentAccounts)}</p>`
        : ""
    }

    ${
      data.otherAssets.additionalIncome
        ? `<p><strong>Additional Income Streams:</strong> ${formatText(data.otherAssets.additionalIncome)}</p>`
        : ""
    }

    ${
      data.otherAssets.debtLiabilities
        ? `<p><strong>Debt and Liabilities:</strong> ${formatText(data.otherAssets.debtLiabilities)}</p>`
        : ""
    }

    <h3>Lifestyle Indicators</h3>

    ${
      data.lifestyleIndicators.spendingPatterns
        ? `<p><strong>Spending Patterns:</strong> ${formatText(data.lifestyleIndicators.spendingPatterns)}</p>`
        : ""
    }

    ${
      data.lifestyleIndicators.livingCosts
        ? `<p><strong>Monthly/Annual Living Costs:</strong> ${formatText(data.lifestyleIndicators.livingCosts)}</p>`
        : ""
    }

    ${
      data.lifestyleIndicators.netWorthAssessment
        ? `<p><strong>Overall Net Worth Assessment:</strong> ${formatText(data.lifestyleIndicators.netWorthAssessment)}</p>`
        : ""
    }

    <!-- SECTION 5: PHILANTHROPIC HISTORY, INTERESTS, AND GIVING CAPACITY -->
    <h2 class="page-break-before">Philanthropic History, Interests, and Giving Capacity</h2>

    <h3>Giving Vehicle(s)</h3>

    ${
      data.philanthropic.givingVehicle
        ? `<p><strong>Primary Giving Method:</strong> ${formatText(data.philanthropic.givingVehicle)}</p>`
        : ""
    }

    ${
      data.philanthropic.taxStrategy
        ? `<p><strong>Tax Planning Strategy:</strong> ${formatText(data.philanthropic.taxStrategy)}</p>`
        : ""
    }

    <h3>Annual Giving Volume</h3>

    ${
      data.philanthropic.annualVolume?.documented
        ? `<p><strong>Documented Giving:</strong> ${formatText(data.philanthropic.annualVolume.documented)}</p>`
        : ""
    }

    ${
      data.philanthropic.annualVolume?.estimated
        ? `<p><strong>Estimated Annual Volume:</strong> ${formatText(data.philanthropic.annualVolume.estimated)}</p>`
        : ""
    }

    <h3>Documented Philanthropic Interests</h3>

    ${
      data.philanthropic.documentedInterests
        ? `<p><strong>Primary Focus Areas:</strong> ${formatText(data.philanthropic.documentedInterests)}</p>`
        : ""
    }

    ${
      data.philanthropic.givingPatterns
        ? `<p><strong>Giving Patterns:</strong> ${formatText(data.philanthropic.givingPatterns)}</p>`
        : ""
    }

    ${
      data.philanthropic.potentialInterests
        ? `
    <h3>Potential Additional Interests</h3>
    <p>${formatText(data.philanthropic.potentialInterests)}</p>
    `
        : ""
    }

    ${
      data.philanthropic.philosophy
        ? `
    <h3>Giving Philosophy and Approach</h3>

    ${data.philanthropic.philosophy.motivations ? `<p><strong>Motivations:</strong> ${formatText(data.philanthropic.philosophy.motivations)}</p>` : ""}

    ${data.philanthropic.philosophy.preferences ? `<p><strong>Preferences:</strong> ${formatText(data.philanthropic.philosophy.preferences)}</p>` : ""}

    ${data.philanthropic.philosophy.valuesAlignment ? `<p><strong>Values-Based Alignment:</strong> ${formatText(data.philanthropic.philosophy.valuesAlignment)}</p>` : ""}
    `
        : ""
    }

    <h3>Giving Capacity Assessment</h3>

    <div class="callout">
        <div class="label">Major Gift Capacity</div>
        <div class="big">${escapeHtml(data.givingCapacity.recommendedAskRange)}</div>
        <p class="notes"><strong>Single Gift:</strong> ${escapeHtml(data.givingCapacity.singleGift || "N/A")} | <strong>5-Year Pledge:</strong> ${escapeHtml(data.givingCapacity.fiveYearPledge || "N/A")} | <strong>Annual Capacity:</strong> ${escapeHtml(data.givingCapacity.annualCapacity || "N/A")}</p>
        ${data.givingCapacity.basis ? `<p class="notes" style="margin-top: 0.4em;"><strong>Basis:</strong> ${formatText(data.givingCapacity.basis)}</p>` : ""}
    </div>

    <!-- SECTION 6: ENGAGEMENT AND SOLICITATION STRATEGY -->
    <h2>Engagement and Solicitation Strategy</h2>

    ${
      data.engagement.positioningPoints && data.engagement.positioningPoints.length > 0
        ? `
    <h3>Key Positioning Points</h3>

    <ul>
        ${data.engagement.positioningPoints.map((point) => `<li>${formatText(point)}</li>`).join("\n        ")}
    </ul>
    `
        : ""
    }

    ${
      data.engagement.phases
        ? `
    <h3>Recommended Engagement Approach (Phases 1–3)</h3>

    <div class="subsection">
        ${
          data.engagement.phases.discovery && data.engagement.phases.discovery.length > 0
            ? `
        <p><strong>Phase 1: Discovery & Relationship Building (Months 1–3)</strong></p>
        <ul>
            ${data.engagement.phases.discovery.map((item) => `<li>${formatText(item)}</li>`).join("\n            ")}
        </ul>
        `
            : ""
        }
        ${
          data.engagement.phases.positioning && data.engagement.phases.positioning.length > 0
            ? `
        <p style="margin-top: 0.6em;"><strong>Phase 2: Positioning & Pre-Ask (Months 4–6)</strong></p>
        <ul>
            ${data.engagement.phases.positioning.map((item) => `<li>${formatText(item)}</li>`).join("\n            ")}
        </ul>
        `
            : ""
        }
        ${
          data.engagement.phases.solicitation && data.engagement.phases.solicitation.length > 0
            ? `
        <p style="margin-top: 0.6em;"><strong>Phase 3: Solicitation & Commitment (Months 7–9)</strong></p>
        <ul>
            ${data.engagement.phases.solicitation.map((item) => `<li>${formatText(item)}</li>`).join("\n            ")}
        </ul>
        `
            : ""
        }
    </div>
    `
        : ""
    }

    ${
      data.engagement.connectionPoints && data.engagement.connectionPoints.length > 0
        ? `
    <h3>Connection Points and Affinity</h3>

    <ul>
        ${data.engagement.connectionPoints.map((point) => `<li>${formatText(point)}</li>`).join("\n        ")}
    </ul>
    `
        : ""
    }

    ${
      data.engagement.guardrails && data.engagement.guardrails.length > 0
        ? `
    <h3>Solicitation Guardrails (What NOT to Do)</h3>

    <ul>
        ${data.engagement.guardrails.map((item) => `<li>${formatText(item)}</li>`).join("\n        ")}
    </ul>
    `
        : ""
    }

    ${
      (data.engagement.greenLights && data.engagement.greenLights.length > 0) ||
      (data.engagement.redFlags && data.engagement.redFlags.length > 0)
        ? `
    <h3>Success Indicators & Red Flags</h3>

    ${
      data.engagement.greenLights && data.engagement.greenLights.length > 0
        ? `
    <p><strong>Green Lights (Proceed with Solicitation):</strong></p>
    <ul>
        ${data.engagement.greenLights.map((item) => `<li>${formatText(item)}</li>`).join("\n        ")}
    </ul>
    `
        : ""
    }

    ${
      data.engagement.redFlags && data.engagement.redFlags.length > 0
        ? `
    <p><strong>Red Flags (Pause or Recalibrate):</strong></p>
    <ul>
        ${data.engagement.redFlags.map((item) => `<li>${formatText(item)}</li>`).join("\n        ")}
    </ul>
    `
        : ""
    }
    `
        : ""
    }

    <!-- SECTION 7: SUMMARY - MAJOR GIVING ASSESSMENT -->
    <h2>Summary: Major Giving Assessment</h2>

    <div class="callout">
        ${data.summary.prospectGrade ? `<p><strong>Prospect Grade:</strong> ${escapeHtml(data.summary.prospectGrade)}</p>` : ""}
        ${data.summary.priorityLevel ? `<p><strong>Priority Level:</strong> ${escapeHtml(data.summary.priorityLevel)}</p>` : ""}
        ${data.summary.timelineToSolicitation ? `<p><strong>Timeline to Solicitation:</strong> ${escapeHtml(data.summary.timelineToSolicitation)}</p>` : ""}
        ${data.summary.expectedROI ? `<p><strong>Expected ROI:</strong> ${escapeHtml(data.summary.expectedROI)}</p>` : ""}
        ${data.summary.strategicValue ? `<p><strong>Strategic Value:</strong> ${formatText(data.summary.strategicValue)}</p>` : ""}
    </div>

    <!-- SECTION 8: SOURCES AND RESEARCH METHODOLOGY -->
    <h2>Sources and Research Methodology</h2>

    <p><strong>Data Sources:</strong></p>

    <ul>
        ${data.sources?.publicRecords ? `<li>Public records: ${data.sources.publicRecords.map(escapeHtml).join(", ")}</li>` : ""}
        ${data.sources?.digitalPresence ? `<li>Digital presence: ${data.sources.digitalPresence.map(escapeHtml).join(", ")}</li>` : ""}
        ${data.sources?.professionalDatabases ? `<li>Professional databases: ${data.sources.professionalDatabases.map(escapeHtml).join(", ")}</li>` : ""}
        ${data.sources?.interviews ? `<li>Personal interviews: ${data.sources.interviews.map(escapeHtml).join(", ")}</li>` : ""}
        ${data.sources?.otherSources ? `<li>Other sources: ${data.sources.otherSources.map(escapeHtml).join(", ")}</li>` : ""}
    </ul>

    ${data.researchLimitations ? `<p><strong>Research Limitations:</strong> ${formatText(data.researchLimitations)}</p>` : ""}

    <!-- SECTION 9: CONCLUSION -->
    <h2>Conclusion</h2>

    ${data.conclusion ? `<p>${formatText(data.conclusion)}</p>` : ""}

    <!-- FOOTER -->
    <div class="footer">
        <p><strong>Report Prepared:</strong> ${escapeHtml(data.reportDate)} | <strong>Prepared For:</strong> ${escapeHtml(data.preparedFor || "Internal Use")}</p>
        ${!hideDefaultFooter ? `<p style="font-size: 9pt; margin-top: 0.5em; color: var(--color-muted);">This report contains confidential proprietary research intended for internal use by fundraising professionals. All estimates are based on available public information and professional analysis. Recommendations should be refined through direct conversation with prospect.</p>
        <p style="font-size: 8pt; margin-top: 0.75em; color: var(--color-muted);">Generated by Rōmy &bull; intel.getromy.app</p>` : ""}
        ${customFooterText ? `<p style="font-size: 9pt; margin-top: ${hideDefaultFooter ? "0.5em" : "0.75em"}; color: var(--color-muted);">${escapeHtml(customFooterText)}</p>` : ""}
    </div>

</body>
</html>`
}
