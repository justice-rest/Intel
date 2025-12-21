"use client"

/**
 * Client-side Prospect PDF Export
 *
 * Uses react-pdf/renderer for browser-based PDF generation.
 * Matches the Rōmy brand styling from pdf.html.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Font,
} from "@react-pdf/renderer"
import type { ProspectReportData } from "./template"

// Register Inter font
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZg.ttf",
      fontWeight: 500,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZg.ttf",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYMZg.ttf",
      fontWeight: 700,
    },
  ],
})

// Brand colors from pdf.html
const COLORS = {
  heading: "#545F63",
  accent: "#00A5E4",
  text: "#000000",
  muted: "#666666",
  accentLight: "rgba(0, 165, 228, 0.06)",
  accentMedium: "rgba(0, 165, 228, 0.10)",
  border: "rgba(84, 95, 99, 0.25)",
}

// Styles matching pdf.html
const styles = StyleSheet.create({
  page: {
    padding: "0.85in",
    fontFamily: "Inter",
    fontSize: 10.75,
    lineHeight: 1.45,
    color: COLORS.text,
    backgroundColor: "#ffffff",
  },
  logo: {
    maxWidth: 144, // 2in
    maxHeight: 36, // 0.5in
    marginBottom: 18,
  },
  h1: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.heading,
    marginTop: 4,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 12.5,
    fontWeight: 700,
    color: COLORS.heading,
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.heading,
    paddingBottom: 4,
    letterSpacing: -0.15,
  },
  h3: {
    fontSize: 10.75,
    fontWeight: 600,
    color: COLORS.heading,
    marginTop: 18,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 10,
  },
  strong: {
    fontWeight: 600,
    color: COLORS.heading,
  },
  executiveSummary: {
    backgroundColor: COLORS.accentMedium,
    padding: 14,
    marginTop: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  atAGlance: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
    marginTop: 12,
    marginBottom: 16,
  },
  atAGlanceItem: {
    width: "50%",
    marginBottom: 12,
  },
  atAGlanceKey: {
    fontSize: 9.6,
    fontWeight: 600,
    color: COLORS.heading,
    marginBottom: 2,
  },
  atAGlanceValue: {
    fontSize: 10.5,
  },
  callout: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    padding: 12,
    marginTop: 16,
    marginBottom: 14,
    backgroundColor: "rgba(0, 165, 228, 0.04)",
  },
  calloutLabel: {
    fontSize: 9.25,
    fontWeight: 600,
    textTransform: "uppercase",
    color: COLORS.heading,
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  calloutBig: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.heading,
    marginTop: 2,
    marginBottom: 6,
  },
  calloutNotes: {
    fontSize: 10.25,
    color: COLORS.text,
  },
  subsection: {
    backgroundColor: "rgba(0, 165, 228, 0.045)",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 165, 228, 0.22)",
  },
  list: {
    marginLeft: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  listBullet: {
    width: 12,
    fontSize: 10,
  },
  listContent: {
    flex: 1,
  },
  footer: {
    marginTop: 36,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: COLORS.heading,
  },
  footerText: {
    fontSize: 9.75,
  },
  footerDisclaimer: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 8,
  },
})

interface ProspectPdfDocumentProps {
  data: ProspectReportData
  logoSrc?: string
}

function ProspectPdfDocument({ data, logoSrc }: ProspectPdfDocumentProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        {logoSrc && <Image src={logoSrc} style={styles.logo} />}

        <Text style={styles.h1}>Donor Profile</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.strong}>Prospect Name:</Text> {data.prospectName} |{" "}
          <Text style={styles.strong}>Location:</Text> {data.location}
        </Text>

        {/* Executive Summary */}
        <Text style={styles.h2}>Executive Summary</Text>
        <View style={styles.executiveSummary}>
          <Text>{data.executiveSummary || "No summary available."}</Text>
        </View>

        {/* Personal Background */}
        <Text style={styles.h2}>Personal Background and Contact Information</Text>
        <View style={styles.atAGlance}>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Name</Text>
            <Text style={styles.atAGlanceValue}>{data.personal.fullName}</Text>
          </View>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Current Location</Text>
            <Text style={styles.atAGlanceValue}>
              {data.personal.currentLocation || "Not available"}
            </Text>
          </View>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Age / Birth Year</Text>
            <Text style={styles.atAGlanceValue}>
              {data.personal.ageBirthYear || "Not available"}
            </Text>
          </View>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Family Status</Text>
            <Text style={styles.atAGlanceValue}>
              {data.personal.familyStatus || "Not available"}
            </Text>
          </View>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Primary Residence</Text>
            <Text style={styles.atAGlanceValue}>
              {data.personal.primaryResidence || "Not available"}
            </Text>
          </View>
          <View style={styles.atAGlanceItem}>
            <Text style={styles.atAGlanceKey}>Contact Information</Text>
            <Text style={styles.atAGlanceValue}>
              {data.personal.contactInfo || "Not available"}
            </Text>
          </View>
        </View>

        {data.personalBackground && (
          <>
            <Text style={styles.h3}>Personal Background</Text>
            <Text style={styles.paragraph}>{data.personalBackground}</Text>
          </>
        )}

        {/* Professional Background */}
        <Text style={styles.h2}>Professional Background</Text>
        {data.professional.currentPositions && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Current Position(s):</Text>{" "}
            {data.professional.currentPositions}
          </Text>
        )}
        {data.professional.careerTrajectory && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Career Trajectory:</Text>{" "}
            {data.professional.careerTrajectory}
          </Text>
        )}
        {data.professional.education && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Education:</Text> {data.professional.education}
          </Text>
        )}

        {/* Wealth Indicators */}
        <Text style={styles.h2}>Wealth Indicators and Asset Profile</Text>
        <Text style={styles.h3}>Real Estate Holdings</Text>
        {data.realEstate.primaryResidence && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Primary Residence:</Text>{" "}
            {data.realEstate.primaryResidence}
          </Text>
        )}
        {data.realEstate.additionalProperties && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Additional Properties:</Text>{" "}
            {data.realEstate.additionalProperties}
          </Text>
        )}

        <Text style={styles.h3}>Business Interests</Text>
        {data.businessInterests.currentEquity && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Current Business Equity:</Text>{" "}
            {data.businessInterests.currentEquity}
          </Text>
        )}

        {data.lifestyleIndicators.netWorthAssessment && (
          <>
            <Text style={styles.h3}>Net Worth Assessment</Text>
            <Text style={styles.paragraph}>
              {data.lifestyleIndicators.netWorthAssessment}
            </Text>
          </>
        )}

        {/* Philanthropic */}
        <Text style={styles.h2}>Philanthropic History and Giving Capacity</Text>
        {data.philanthropic.documentedInterests && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Documented Interests:</Text>{" "}
            {data.philanthropic.documentedInterests}
          </Text>
        )}

        {/* Giving Capacity Callout */}
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>Major Gift Capacity</Text>
          <Text style={styles.calloutBig}>{data.givingCapacity.recommendedAskRange}</Text>
          <Text style={styles.calloutNotes}>
            {data.givingCapacity.singleGift && (
              <>
                <Text style={styles.strong}>Single Gift:</Text> {data.givingCapacity.singleGift} |{" "}
              </>
            )}
            {data.givingCapacity.fiveYearPledge && (
              <>
                <Text style={styles.strong}>5-Year Pledge:</Text>{" "}
                {data.givingCapacity.fiveYearPledge} |{" "}
              </>
            )}
            {data.givingCapacity.annualCapacity && (
              <>
                <Text style={styles.strong}>Annual Capacity:</Text>{" "}
                {data.givingCapacity.annualCapacity}
              </>
            )}
          </Text>
          {data.givingCapacity.basis && (
            <Text style={[styles.calloutNotes, { marginTop: 6 }]}>
              <Text style={styles.strong}>Basis:</Text> {data.givingCapacity.basis}
            </Text>
          )}
        </View>

        {/* Summary */}
        <Text style={styles.h2}>Summary: Major Giving Assessment</Text>
        <View style={styles.callout}>
          {data.summary.prospectGrade && (
            <Text style={styles.calloutNotes}>
              <Text style={styles.strong}>Prospect Grade:</Text> {data.summary.prospectGrade}
            </Text>
          )}
          {data.summary.priorityLevel && (
            <Text style={styles.calloutNotes}>
              <Text style={styles.strong}>Priority Level:</Text> {data.summary.priorityLevel}
            </Text>
          )}
          {data.summary.strategicValue && (
            <Text style={styles.calloutNotes}>
              <Text style={styles.strong}>Strategic Value:</Text> {data.summary.strategicValue}
            </Text>
          )}
        </View>

        {/* Conclusion */}
        {data.conclusion && (
          <>
            <Text style={styles.h2}>Conclusion</Text>
            <Text style={styles.paragraph}>{data.conclusion}</Text>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.strong}>Report Prepared:</Text> {data.reportDate} |{" "}
            <Text style={styles.strong}>Prepared For:</Text>{" "}
            {data.preparedFor || "Internal Use"}
          </Text>
          <Text style={styles.footerDisclaimer}>
            This report contains confidential proprietary research intended for internal use
            by fundraising professionals. All estimates are based on available public
            information and professional analysis.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

/**
 * Export prospect report to PDF (client-side)
 */
export async function exportProspectToPdf(
  data: ProspectReportData,
  logoSrc?: string
): Promise<void> {
  // Generate the PDF blob
  const blob = await pdf(
    <ProspectPdfDocument data={data} logoSrc={logoSrc || "/BrandmarkRōmy.png"} />
  ).toBlob()

  // Generate filename
  const sanitizedName = data.prospectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)

  const filename = `romy-donor-profile-${sanitizedName}-${new Date().toISOString().split("T")[0]}.pdf`

  // Download the file
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
