/**
 * Prospect Report PDF Module
 *
 * Generates professional donor profile PDFs matching the Rōmy brand.
 *
 * Usage:
 * ```typescript
 * import { generateProspectPdf, batchItemToReportData } from "@/lib/prospect-pdf"
 *
 * // From batch item
 * const reportData = batchItemToReportData(batchItem, "My Organization")
 * const { buffer, filename } = await generateProspectPdf({ data: reportData })
 *
 * // Direct data
 * const { buffer, filename } = await generateProspectPdf({
 *   data: {
 *     prospectName: "John Smith",
 *     location: "San Francisco, CA",
 *     // ... other fields
 *   }
 * })
 * ```
 */

export {
  generateProspectPdf,
  generatePdfFromHtml,
  isPdfGenerationAvailable,
  type GeneratePdfOptions,
  type GeneratePdfResult,
} from "./generator"

export {
  generateProspectReportHtml,
  getLogoBase64,
  type ProspectReportData,
} from "./template"

export {
  batchItemToReportData,
  cacheToReportData,
  createMinimalReportData,
  type BatchProspectItem,
  type ProspectDataCache,
} from "./converters"
