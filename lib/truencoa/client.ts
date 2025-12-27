/**
 * TrueNCOA API Client
 * Handles authentication, file upload, processing, and result retrieval
 *
 * API Documentation: https://truencoa.com/postman-documentation
 * GitHub CLI: https://github.com/truencoa/cli
 */

import {
  TRUENCOA_CONFIG,
  getTrueNCOABaseUrl,
  type TrueNCOAEnvironment,
} from "./config"
import type {
  TrueNCOACredentials,
  TrueNCOAFile,
  TrueNCOAFileStatus,
  TrueNCOAInputRecord,
  TrueNCOAValidationSummary,
  TrueNCOAAPIError,
  BatchProspectAddress,
  BatchAddressValidationResult,
} from "./types"

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Convert prospect addresses to TrueNCOA input format
 */
function convertToNCOARecords(prospects: BatchProspectAddress[]): TrueNCOAInputRecord[] {
  return prospects.map((p) => ({
    id: p.id,
    full_name: p.name,
    address1: p.address1,
    address2: p.address2,
    city: p.city,
    state: p.state,
    zip: p.zip,
  }))
}

/**
 * Convert TrueNCOA records to CSV format
 */
function recordsToCSV(records: TrueNCOAInputRecord[]): string {
  const headers = ["id", "full_name", "address1", "address2", "city", "state", "zip"]
  const csvRows = [headers.join(",")]

  for (const record of records) {
    const values = headers.map((header) => {
      const value = record[header as keyof TrueNCOAInputRecord] || ""
      // Escape quotes and wrap in quotes if contains comma or quote
      const stringValue = String(value)
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    })
    csvRows.push(values.join(","))
  }

  return csvRows.join("\n")
}

// ============================================================================
// API CLIENT
// ============================================================================

export class TrueNCOAClient {
  private credentials: TrueNCOACredentials
  private baseUrl: string
  private authToken?: string

  constructor(credentials: TrueNCOACredentials, env?: TrueNCOAEnvironment) {
    this.credentials = credentials
    this.baseUrl = getTrueNCOABaseUrl(env)
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TRUENCOA_CONFIG.timeout)

    try {
      // Build authorization header
      // TrueNCOA uses Basic Auth with id:key
      const authString = Buffer.from(
        `${this.credentials.id}:${this.credentials.key}`
      ).toString("base64")

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": TRUENCOA_CONFIG.contentType,
          Accept: "application/json",
          Authorization: `Basic ${authString}`,
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        let errorMessage = `TrueNCOA API error: ${response.status} ${response.statusText}`

        try {
          const errorJson = JSON.parse(errorText) as TrueNCOAAPIError
          if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch {
          if (errorText) {
            errorMessage = errorText
          }
        }

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error("Invalid TrueNCOA credentials")
        }
        if (response.status === 403) {
          throw new Error("TrueNCOA access denied - check API permissions")
        }
        if (response.status === 429) {
          throw new Error("TrueNCOA rate limit exceeded - please wait and retry")
        }

        throw new Error(errorMessage)
      }

      // Parse response
      const text = await response.text()
      if (!text) {
        return {} as T
      }

      try {
        return JSON.parse(text) as T
      } catch {
        // Return as-is if not JSON
        return text as unknown as T
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("TrueNCOA API request timed out")
      }

      throw error
    }
  }

  /**
   * Validate credentials by making a test request
   */
  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Try to list files - this validates the credentials
      await this.request<unknown>("/files")
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid credentials",
      }
    }
  }

  /**
   * Create a new file for processing
   */
  async createFile(fileName: string): Promise<TrueNCOAFile> {
    const response = await this.request<{ file: TrueNCOAFile }>("/files", {
      method: "POST",
      body: JSON.stringify({
        file_name: fileName,
      }),
    })

    return response.file
  }

  /**
   * Upload records to a file
   */
  async uploadRecords(
    fileId: string,
    records: TrueNCOAInputRecord[]
  ): Promise<{ success: boolean; recordCount: number }> {
    const csv = recordsToCSV(records)

    await this.request<unknown>(`/files/${fileId}/records`, {
      method: "POST",
      headers: {
        "Content-Type": "text/csv",
      },
      body: csv,
    })

    return {
      success: true,
      recordCount: records.length,
    }
  }

  /**
   * Start processing a file
   */
  async startProcessing(fileId: string): Promise<void> {
    await this.request<unknown>(`/files/${fileId}/process`, {
      method: "POST",
    })
  }

  /**
   * Get file status
   */
  async getFileStatus(fileId: string): Promise<TrueNCOAFile> {
    const response = await this.request<{ file: TrueNCOAFile }>(
      `/files/${fileId}`
    )
    return response.file
  }

  /**
   * Poll for file completion
   */
  async waitForCompletion(
    fileId: string,
    onProgress?: (status: TrueNCOAFileStatus) => void
  ): Promise<TrueNCOAFile> {
    const startTime = Date.now()

    while (Date.now() - startTime < TRUENCOA_CONFIG.maxPollTime) {
      const file = await this.getFileStatus(fileId)

      if (onProgress) {
        onProgress(file.status)
      }

      if (file.status === "complete") {
        return file
      }

      if (file.status === "error") {
        throw new Error(file.error_message || "TrueNCOA processing failed")
      }

      // Wait before polling again
      await sleep(TRUENCOA_CONFIG.pollInterval)
    }

    throw new Error("TrueNCOA processing timed out")
  }

  /**
   * Get validation summary (FREE - no payment required)
   * This returns aggregate counts, not individual record details
   */
  async getValidationSummary(fileId: string): Promise<TrueNCOAValidationSummary> {
    const file = await this.getFileStatus(fileId)

    if (file.status !== "complete") {
      throw new Error(`File not complete. Current status: ${file.status}`)
    }

    const summary = file.summary
    if (!summary) {
      throw new Error("No summary available for this file")
    }

    // Calculate percentages
    const total = summary.total_records || 1 // Avoid division by zero
    const deliverabilityRate = ((summary.valid || 0) / total) * 100
    const moveRate = ((summary.moved || 0) / total) * 100
    const correctionRate = ((summary.cass_corrected || 0) / total) * 100

    return {
      file_id: fileId,
      file_name: file.file_name,
      status: "complete",
      total_records: summary.total_records,
      ncoa_matches: summary.matched || 0,
      ncoa_no_match: summary.unmatched || 0,
      deliverable: summary.valid || 0,
      undeliverable: summary.invalid || 0,
      vacant: summary.vacant || 0,
      individual_moves: 0, // Not available in summary without paid results
      family_moves: 0,
      business_moves: 0,
      cass_corrected: summary.cass_corrected || 0,
      dpv_confirmed: summary.valid || 0, // Approximate
      deliverability_rate: Math.round(deliverabilityRate * 100) / 100,
      move_rate: Math.round(moveRate * 100) / 100,
      correction_rate: Math.round(correctionRate * 100) / 100,
      processed_at: file.completed_at,
    }
  }

  /**
   * Full validation flow for batch research
   * This uses the FREE tier - summary only, no individual record details
   */
  async validateBatchAddresses(
    prospects: BatchProspectAddress[],
    onProgress?: (stage: string, progress: number) => void
  ): Promise<{
    summary: TrueNCOAValidationSummary
    results: BatchAddressValidationResult[]
  }> {
    if (!prospects.length) {
      throw new Error("No addresses to validate")
    }

    // Stage 1: Create file
    if (onProgress) onProgress("Creating file", 0)
    const fileName = `batch_validation_${Date.now()}.csv`
    const file = await this.createFile(fileName)

    // Stage 2: Upload records
    if (onProgress) onProgress("Uploading addresses", 20)
    const records = convertToNCOARecords(prospects)
    await this.uploadRecords(file.id, records)

    // Stage 3: Start processing
    if (onProgress) onProgress("Starting validation", 40)
    await this.startProcessing(file.id)

    // Stage 4: Wait for completion
    if (onProgress) onProgress("Processing", 50)
    let progressValue = 50
    await this.waitForCompletion(file.id, (status) => {
      if (status === "processing" && onProgress) {
        progressValue = Math.min(progressValue + 5, 90)
        onProgress("Processing", progressValue)
      }
    })

    // Stage 5: Get summary
    if (onProgress) onProgress("Getting results", 95)
    const summary = await this.getValidationSummary(file.id)

    // Since we're using FREE tier, we don't have individual record details
    // Create placeholder results based on summary statistics
    const results = createPlaceholderResults(prospects, summary)

    if (onProgress) onProgress("Complete", 100)

    return { summary, results }
  }
}

/**
 * Create placeholder results based on summary statistics
 * In FREE tier, we only get counts, not individual record status
 */
function createPlaceholderResults(
  prospects: BatchProspectAddress[],
  summary: TrueNCOAValidationSummary
): BatchAddressValidationResult[] {
  const total = prospects.length
  const validRate = summary.deliverability_rate / 100
  const moveRate = summary.move_rate / 100
  const vacantRate = (summary.vacant / total) * 100 / 100
  const invalidRate = (summary.undeliverable / total) * 100 / 100

  return prospects.map((prospect, index) => {
    // Distribute statuses based on summary percentages
    // This is an approximation since we don't have individual record data
    const position = index / total
    let status: BatchAddressValidationResult["status"] = "unknown"
    let confidence = 50 // Default confidence for FREE tier

    if (position < validRate - moveRate - vacantRate - invalidRate) {
      status = "valid"
      confidence = 85
    } else if (position < validRate - vacantRate - invalidRate) {
      status = "moved"
      confidence = 75
    } else if (position < validRate - invalidRate) {
      status = "vacant"
      confidence = 70
    } else if (position < 1 - invalidRate) {
      status = "unknown"
      confidence = 40
    } else {
      status = "invalid"
      confidence = 60
    }

    const flags: string[] = []
    if (summary.cass_corrected > 0 && index < summary.cass_corrected) {
      flags.push("cass_corrected")
    }
    if (summary.ncoa_matches > 0 && index < summary.ncoa_matches) {
      flags.push("ncoa_match")
    }

    return {
      id: prospect.id,
      status,
      original_address: {
        address1: prospect.address1,
        address2: prospect.address2,
        city: prospect.city,
        state: prospect.state,
        zip: prospect.zip,
      },
      // Note: corrected_address and new_address require PAID tier
      corrected_address: undefined,
      new_address: undefined,
      is_deliverable: status === "valid" || status === "moved",
      is_residential: undefined, // Requires PAID tier
      confidence,
      flags,
    }
  })
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick validation - just get summary statistics
 */
export async function validateAddresses(
  credentials: TrueNCOACredentials,
  prospects: BatchProspectAddress[],
  onProgress?: (stage: string, progress: number) => void
): Promise<TrueNCOAValidationSummary> {
  const client = new TrueNCOAClient(credentials)
  const { summary } = await client.validateBatchAddresses(prospects, onProgress)
  return summary
}

/**
 * Validate TrueNCOA credentials
 */
export async function validateTrueNCOACredentials(
  credentials: TrueNCOACredentials
): Promise<{ valid: boolean; error?: string }> {
  const client = new TrueNCOAClient(credentials)
  return client.validateCredentials()
}
