/**
 * CSV/Excel Parser for Batch Processing
 * Parses uploaded files and extracts prospect data
 */

import Papa from "papaparse"
import * as XLSX from "xlsx"
import {
  ParsedFileResult,
  ColumnMapping,
  ProspectInputData,
} from "./types"
import {
  detectColumnMapping,
  validateProspectData,
  MAX_PROSPECTS_PER_BATCH,
  ALLOWED_BATCH_EXTENSIONS,
  parseFullName,
  combineNames,
} from "./config"

// ============================================================================
// FILE TYPE DETECTION
// ============================================================================

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".")
  if (lastDot === -1) return ""
  return fileName.slice(lastDot).toLowerCase()
}

function isCSV(fileName: string): boolean {
  return getFileExtension(fileName) === ".csv"
}

function isExcel(fileName: string): boolean {
  const ext = getFileExtension(fileName)
  return ext === ".xlsx" || ext === ".xls"
}

// ============================================================================
// CSV PARSING
// ============================================================================

async function parseCSV(
  content: string | ArrayBuffer
): Promise<{ rows: Record<string, string>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    const text = typeof content === "string"
      ? content
      : new TextDecoder().decode(content)

    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          // Log errors but don't fail - partial parse is better than none
          console.warn("CSV parse warnings:", results.errors)
        }

        const columns = results.meta.fields || []
        resolve({
          rows: results.data,
          columns,
        })
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      },
    })
  })
}

// ============================================================================
// EXCEL PARSING
// ============================================================================

async function parseExcel(
  content: ArrayBuffer
): Promise<{ rows: Record<string, string>[]; columns: string[] }> {
  try {
    const workbook = XLSX.read(content, { type: "array" })

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error("Excel file has no sheets")
    }

    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    })

    if (jsonData.length < 2) {
      throw new Error("Excel file must have at least a header row and one data row")
    }

    // First row is headers
    const firstRow = jsonData[0]
    const columns = (Array.isArray(firstRow) ? firstRow : Object.values(firstRow)).map((h) => String(h).trim())

    // Convert remaining rows to objects
    const rows: Record<string, string>[] = []
    for (let i = 1; i < jsonData.length; i++) {
      const rawRow = jsonData[i]
      const rowData = Array.isArray(rawRow) ? rawRow : Object.values(rawRow)
      const row: Record<string, string> = {}

      columns.forEach((col, index) => {
        const value = rowData[index]
        row[col] = value !== undefined && value !== null ? String(value).trim() : ""
      })

      // Skip completely empty rows
      const hasData = Object.values(row).some((v) => v.length > 0)
      if (hasData) {
        rows.push(row)
      }
    }

    return { rows, columns }
  } catch (error) {
    throw new Error(
      `Excel parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

// ============================================================================
// MAIN PARSE FUNCTION
// ============================================================================

/**
 * Parse a CSV or Excel file and return structured prospect data
 */
export async function parseProspectFile(
  file: File
): Promise<ParsedFileResult> {
  const errors: string[] = []

  // Validate file extension
  const ext = getFileExtension(file.name)
  if (!ALLOWED_BATCH_EXTENSIONS.includes(ext)) {
    return {
      success: false,
      rows: [],
      columns: [],
      total_rows: 0,
      errors: [`Unsupported file type: ${ext}. Please use CSV or Excel (.xlsx, .xls)`],
      suggested_mapping: {},
    }
  }

  try {
    // Read file content
    const content = await file.arrayBuffer()

    // Parse based on file type
    let parsed: { rows: Record<string, string>[]; columns: string[] }

    if (isCSV(file.name)) {
      parsed = await parseCSV(content)
    } else if (isExcel(file.name)) {
      parsed = await parseExcel(content)
    } else {
      return {
        success: false,
        rows: [],
        columns: [],
        total_rows: 0,
        errors: ["Unable to determine file type"],
        suggested_mapping: {},
      }
    }

    // Check if we got any data
    if (parsed.rows.length === 0) {
      return {
        success: false,
        rows: [],
        columns: parsed.columns,
        total_rows: 0,
        errors: ["File contains no data rows"],
        suggested_mapping: {},
      }
    }

    // Check max limit
    if (parsed.rows.length > MAX_PROSPECTS_PER_BATCH) {
      errors.push(
        `File contains ${parsed.rows.length} rows, but maximum is ${MAX_PROSPECTS_PER_BATCH}. ` +
        `Only the first ${MAX_PROSPECTS_PER_BATCH} rows will be processed.`
      )
      parsed.rows = parsed.rows.slice(0, MAX_PROSPECTS_PER_BATCH)
    }

    // Detect column mapping
    const suggested_mapping = detectColumnMapping(parsed.columns) as Partial<ColumnMapping>

    // Check if we found a name column
    if (!suggested_mapping.name) {
      errors.push(
        "Could not auto-detect 'Name' column. Please map it manually. " +
        `Available columns: ${parsed.columns.join(", ")}`
      )
    }

    return {
      success: errors.length === 0 || errors.every(e => e.includes("Only the first")),
      rows: parsed.rows,
      columns: parsed.columns,
      total_rows: parsed.rows.length,
      errors,
      suggested_mapping,
    }
  } catch (error) {
    return {
      success: false,
      rows: [],
      columns: [],
      total_rows: 0,
      errors: [error instanceof Error ? error.message : "Failed to parse file"],
      suggested_mapping: {},
    }
  }
}

// ============================================================================
// TRANSFORM TO PROSPECT DATA
// ============================================================================

/**
 * Transform raw rows into normalized ProspectInputData using column mapping
 */
export function transformToProspectData(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): { prospects: ProspectInputData[]; errors: Array<{ row: number; errors: string[] }> } {
  const prospects: ProspectInputData[] = []
  const rowErrors: Array<{ row: number; errors: string[] }> = []

  rows.forEach((row, index) => {
    // Get first_name and last_name from mapping if available
    const mappedFirstName = mapping.first_name ? row[mapping.first_name]?.trim() : undefined
    const mappedLastName = mapping.last_name ? row[mapping.last_name]?.trim() : undefined
    const mappedName = mapping.name ? row[mapping.name]?.trim() || "" : ""

    // Determine the full name and name components
    let fullName: string
    let firstName: string | undefined
    let lastName: string | undefined

    if (mappedFirstName || mappedLastName) {
      // CSV has separate first/last name columns - combine them for full name
      firstName = mappedFirstName
      lastName = mappedLastName
      fullName = combineNames(mappedFirstName, mappedLastName)
    } else if (mappedName) {
      // CSV has full name - parse it into components
      fullName = mappedName
      const parsed = parseFullName(mappedName)
      firstName = parsed.first_name || undefined
      lastName = parsed.last_name || undefined
    } else {
      // No name data
      fullName = ""
    }

    // Apply mapping to get normalized data
    const prospect: ProspectInputData = {
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      address: mapping.address ? row[mapping.address]?.trim() : undefined,
      city: mapping.city ? row[mapping.city]?.trim() : undefined,
      state: mapping.state ? row[mapping.state]?.trim() : undefined,
      zip: mapping.zip ? row[mapping.zip]?.trim() : undefined,
      full_address: mapping.full_address ? row[mapping.full_address]?.trim() : undefined,
      email: mapping.email ? row[mapping.email]?.trim() : undefined,
      phone: mapping.phone ? row[mapping.phone]?.trim() : undefined,
      company: mapping.company ? row[mapping.company]?.trim() : undefined,
      title: mapping.title ? row[mapping.title]?.trim() : undefined,
      notes: mapping.notes ? row[mapping.notes]?.trim() : undefined,
    }

    // Include all original columns as custom fields (except mapped ones)
    const mappedColumns = new Set(
      Object.values(mapping).filter((v): v is string => v !== null && v !== undefined)
    )

    for (const [key, value] of Object.entries(row)) {
      if (!mappedColumns.has(key) && value?.trim()) {
        prospect[key] = value.trim()
      }
    }

    // Validate
    const validation = validateProspectData(prospect)

    if (!validation.valid) {
      rowErrors.push({
        row: index + 2, // +2 for header row and 0-indexing
        errors: validation.errors,
      })
    } else {
      prospects.push(prospect)
    }
  })

  return { prospects, errors: rowErrors }
}

// ============================================================================
// BUILD PROSPECT QUERY STRING
// ============================================================================

/**
 * Build a search-friendly string for prospect research
 */
export function buildProspectQueryString(prospect: ProspectInputData): string {
  const parts: string[] = []

  // Name is always included
  if (prospect.name) {
    parts.push(prospect.name)
  }

  // Build address string
  if (prospect.full_address) {
    parts.push(prospect.full_address)
  } else {
    const addressParts: string[] = []
    if (prospect.address) addressParts.push(prospect.address)
    if (prospect.city) addressParts.push(prospect.city)
    if (prospect.state) addressParts.push(prospect.state)
    if (prospect.zip) addressParts.push(prospect.zip)

    if (addressParts.length > 0) {
      parts.push(addressParts.join(", "))
    }
  }

  return parts.join(", ")
}

// ============================================================================
// VALIDATION SUMMARY
// ============================================================================

/**
 * Get a summary of validation results for display
 */
export function getValidationSummary(
  totalRows: number,
  validCount: number,
  errors: Array<{ row: number; errors: string[] }>
): {
  valid: number
  invalid: number
  errorSummary: string
  canProceed: boolean
} {
  return {
    valid: validCount,
    invalid: errors.length,
    errorSummary:
      errors.length > 0
        ? `${errors.length} row(s) have validation errors and will be skipped`
        : "All rows are valid",
    canProceed: validCount > 0,
  }
}
