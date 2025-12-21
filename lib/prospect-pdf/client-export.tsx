"use client"

/**
 * Client-side Prospect PDF Export
 *
 * Uses react-pdf/renderer for browser-based PDF generation.
 * Matches the updated Rōmy brand styling (centered header, slate colors).
 *
 * NOTE: Uses built-in PDF fonts (Helvetica) to avoid CSP issues
 * with external font loading from fonts.gstatic.com
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer"
import type { ProspectReportData } from "./template"

// Updated brand colors - slate palette matching template.ts
const COLORS = {
  heading: "#0f172a",      // slate-900
  text: "#1e293b",         // slate-800
  muted: "#64748b",        // slate-500
  border: "#e2e8f0",       // slate-200
  bgSubtle: "#f8fafc",     // slate-50
}

// Styles matching the updated template.ts (centered header, clean design)
const styles = StyleSheet.create({
  page: {
    padding: "0.75in 0.85in",
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.6,
    color: COLORS.text,
    backgroundColor: "#ffffff",
  },
  // Centered header like shared page
  header: {
    textAlign: "center",
    marginBottom: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logo: {
    height: 36,
    width: 100,
    marginBottom: 12,
    alignSelf: "center",
  },
  headerDate: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 6,
    textAlign: "center",
  },
  h1: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginBottom: 4,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
  },
  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginTop: 21,
    marginBottom: 9,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.heading,
  },
  h3: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginTop: 15,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 9,
  },
  strong: {
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
  },
  // Info grid - cleaner style
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
    marginBottom: 18,
  },
  infoGridItem: {
    width: "50%",
    marginBottom: 6,
  },
  infoGridLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  infoGridValue: {
    fontSize: 10.5,
    color: COLORS.heading,
  },
  // Summary box
  summaryBox: {
    backgroundColor: COLORS.bgSubtle,
    padding: 12,
    marginTop: 12,
    marginBottom: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Centered callout for giving capacity
  callout: {
    textAlign: "center",
    padding: 15,
    marginTop: 15,
    marginBottom: 15,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calloutLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: "center",
  },
  calloutBig: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginTop: 3,
    marginBottom: 8,
    textAlign: "center",
  },
  calloutNotes: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: "center",
  },
  list: {
    marginLeft: 18,
    marginTop: 6,
    marginBottom: 12,
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
    marginTop: 30,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    textAlign: "center",
  },
  footerText: {
    fontSize: 9,
    color: COLORS.muted,
    textAlign: "center",
  },
  footerDisclaimer: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: "center",
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
        {/* Centered Header */}
        <View style={styles.header}>
          {logoSrc && <Image src={logoSrc} style={styles.logo} />}
          <Text style={styles.headerDate}>{data.reportDate}</Text>
          <Text style={styles.h1}>{data.prospectName}</Text>
          <Text style={styles.subtitle}>
            {data.location}
            {data.preparedFor ? ` | Prepared for ${data.preparedFor}` : ""}
          </Text>
        </View>

        {/* Executive Summary */}
        <Text style={styles.h2}>Executive Summary</Text>
        <View style={styles.summaryBox}>
          <Text>{data.executiveSummary || "No summary available."}</Text>
        </View>

        {/* Personal Background */}
        <Text style={styles.h2}>Personal Background</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Name</Text>
            <Text style={styles.infoGridValue}>{data.personal.fullName}</Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Location</Text>
            <Text style={styles.infoGridValue}>
              {data.personal.currentLocation || "Not available"}
            </Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Age / Birth Year</Text>
            <Text style={styles.infoGridValue}>
              {data.personal.ageBirthYear || "Not available"}
            </Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Contact</Text>
            <Text style={styles.infoGridValue}>
              {data.personal.contactInfo || "Not available"}
            </Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Family Status</Text>
            <Text style={styles.infoGridValue}>
              {data.personal.familyStatus || "Not available"}
            </Text>
          </View>
          <View style={styles.infoGridItem}>
            <Text style={styles.infoGridLabel}>Primary Residence</Text>
            <Text style={styles.infoGridValue}>
              {data.personal.primaryResidence || "Not available"}
            </Text>
          </View>
        </View>

        {data.personalBackground && (
          <>
            <Text style={styles.h3}>Personal Background</Text>
            <Text style={styles.paragraph}>{data.personalBackground}</Text>
          </>
        )}

        {data.spouseInfo && (
          <>
            <Text style={styles.h3}>Spouse / Life Partner</Text>
            <Text style={styles.paragraph}>{data.spouseInfo}</Text>
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
        {data.professional.expertiseCredentials && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Expertise & Credentials:</Text>{" "}
            {data.professional.expertiseCredentials}
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
        {data.realEstate.historicalRealEstate && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Historical Real Estate:</Text>{" "}
            {data.realEstate.historicalRealEstate}
          </Text>
        )}

        <Text style={styles.h3}>Business Interests</Text>
        {data.businessInterests.currentEquity && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Current Business Equity:</Text>{" "}
            {data.businessInterests.currentEquity}
          </Text>
        )}
        {data.businessInterests.businessIncome && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Business Income:</Text>{" "}
            {data.businessInterests.businessIncome}
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
        {data.philanthropic.givingVehicle && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Giving Vehicle:</Text>{" "}
            {data.philanthropic.givingVehicle}
          </Text>
        )}
        {data.philanthropic.documentedInterests && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Documented Interests:</Text>{" "}
            {data.philanthropic.documentedInterests}
          </Text>
        )}
        {data.philanthropic.givingPatterns && (
          <Text style={styles.paragraph}>
            <Text style={styles.strong}>Giving Patterns:</Text>{" "}
            {data.philanthropic.givingPatterns}
          </Text>
        )}

        {/* Giving Capacity Callout - Centered */}
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>Major Gift Capacity</Text>
          <Text style={styles.calloutBig}>{data.givingCapacity.recommendedAskRange}</Text>
          <Text style={styles.calloutNotes}>
            {data.givingCapacity.singleGift && `Single Gift: ${data.givingCapacity.singleGift}`}
            {data.givingCapacity.singleGift && data.givingCapacity.fiveYearPledge && " | "}
            {data.givingCapacity.fiveYearPledge && `5-Year Pledge: ${data.givingCapacity.fiveYearPledge}`}
            {(data.givingCapacity.singleGift || data.givingCapacity.fiveYearPledge) && data.givingCapacity.annualCapacity && " | "}
            {data.givingCapacity.annualCapacity && `Annual: ${data.givingCapacity.annualCapacity}`}
          </Text>
          {data.givingCapacity.basis && (
            <Text style={[styles.calloutNotes, { marginTop: 5 }]}>
              Basis: {data.givingCapacity.basis}
            </Text>
          )}
        </View>

        {/* Engagement Strategy */}
        {data.engagement.positioningPoints && data.engagement.positioningPoints.length > 0 && (
          <>
            <Text style={styles.h2}>Engagement Strategy</Text>
            <Text style={styles.h3}>Key Positioning Points</Text>
            <View style={styles.list}>
              {data.engagement.positioningPoints.map((point, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Text style={styles.listBullet}>•</Text>
                  <Text style={styles.listContent}>{point}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.engagement.connectionPoints && data.engagement.connectionPoints.length > 0 && (
          <>
            <Text style={styles.h3}>Connection Points</Text>
            <View style={styles.list}>
              {data.engagement.connectionPoints.map((point, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Text style={styles.listBullet}>•</Text>
                  <Text style={styles.listContent}>{point}</Text>
                </View>
              ))}
            </View>
          </>
        )}

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
          {data.summary.timelineToSolicitation && (
            <Text style={styles.calloutNotes}>
              <Text style={styles.strong}>Timeline:</Text> {data.summary.timelineToSolicitation}
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

        {/* Footer - Centered */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Report Prepared: {data.reportDate} | Prepared For:{" "}
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
