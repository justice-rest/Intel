"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  FileCsv,
  Upload,
  CheckCircle,
  WarningCircle,
  ArrowRight,
  X,
  Spinner,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import {
  parseProspectFile,
  transformToProspectData,
  getValidationSummary,
  type ParsedFileResult,
  type ColumnMapping,
  type ProspectInputData,
} from "@/lib/batch-processing"
import { MAX_BATCH_FILE_SIZE, ALLOWED_BATCH_EXTENSIONS } from "@/lib/batch-processing/config"

interface BatchUploadProps {
  onUploadComplete: (
    prospects: ProspectInputData[],
    fileName: string,
    fileSize: number,
    columnMapping: ColumnMapping
  ) => void
  isCreatingJob?: boolean
}

type Step = "upload" | "mapping" | "review"

export function BatchUpload({ onUploadComplete, isCreatingJob }: BatchUploadProps) {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParsedFileResult | null>(null)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null)
    setFile(selectedFile)

    // Validate file size
    if (selectedFile.size > MAX_BATCH_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_BATCH_FILE_SIZE / (1024 * 1024)}MB`)
      return
    }

    // Validate extension
    const ext = selectedFile.name.slice(selectedFile.name.lastIndexOf(".")).toLowerCase()
    if (!ALLOWED_BATCH_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type. Please use ${ALLOWED_BATCH_EXTENSIONS.join(", ")}`)
      return
    }

    setIsLoading(true)

    try {
      const result = await parseProspectFile(selectedFile)
      setParseResult(result)

      if (result.success) {
        // Set suggested mapping
        setColumnMapping({
          name: result.suggested_mapping.name || null,
          address: result.suggested_mapping.address || null,
          city: result.suggested_mapping.city || null,
          state: result.suggested_mapping.state || null,
          zip: result.suggested_mapping.zip || null,
          full_address: result.suggested_mapping.full_address || null,
          email: result.suggested_mapping.email || null,
          phone: result.suggested_mapping.phone || null,
          company: result.suggested_mapping.company || null,
          title: result.suggested_mapping.title || null,
          notes: result.suggested_mapping.notes || null,
        })
        setStep("mapping")
      } else {
        setError(result.errors.join(". "))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: value === "__none__" ? null : value,
    }))
  }

  const handleProceedToReview = () => {
    if (!columnMapping.name) {
      setError("Name column is required")
      return
    }
    setError(null)
    setStep("review")
  }

  const handleSubmit = () => {
    if (!parseResult || !file) return

    const { prospects, errors } = transformToProspectData(parseResult.rows, columnMapping)

    if (prospects.length === 0) {
      setError("No valid prospects found. Please check your column mapping.")
      return
    }

    onUploadComplete(prospects, file.name, file.size, columnMapping)
  }

  const handleReset = () => {
    setStep("upload")
    setFile(null)
    setParseResult(null)
    setColumnMapping({ name: null })
    setError(null)
  }

  // Get validation summary for review step
  const validationSummary =
    parseResult && columnMapping.name
      ? (() => {
          const { prospects, errors } = transformToProspectData(
            parseResult.rows,
            columnMapping
          )
          return getValidationSummary(parseResult.total_rows, prospects.length, errors)
        })()
      : null

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {(["upload", "mapping", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step === "review" && s !== "review"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div
                className={cn(
                  "h-0.5 w-8",
                  (step === "mapping" && s === "upload") ||
                    step === "review"
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: File Upload */}
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isLoading
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Parsing file...</p>
                </div>
              ) : (
                <>
                  <FileCsv className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Upload Prospect List</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop a CSV or Excel file, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supports: {ALLOWED_BATCH_EXTENSIONS.join(", ")} (max{" "}
                    {MAX_BATCH_FILE_SIZE / (1024 * 1024)}MB)
                  </p>
                  <label htmlFor="batch-file-input">
                    <Button asChild variant="outline">
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose File
                      </span>
                    </Button>
                  </label>
                  <input
                    id="batch-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && parseResult && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Map Columns</h3>
                <p className="text-sm text-muted-foreground">
                  Match your file columns to prospect fields
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {parseResult.total_rows} rows found
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Required Fields */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Required</h4>
                <div className="space-y-2">
                  <Label htmlFor="map-name">Name *</Label>
                  <Select
                    value={columnMapping.name || "__none__"}
                    onValueChange={(v) => handleMappingChange("name", v)}
                  >
                    <SelectTrigger id="map-name">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Not mapped --</SelectItem>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Address Fields */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Address</h4>
                <div className="space-y-2">
                  <Label htmlFor="map-address">Street Address</Label>
                  <Select
                    value={columnMapping.address || "__none__"}
                    onValueChange={(v) => handleMappingChange("address", v)}
                  >
                    <SelectTrigger id="map-address">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Not mapped --</SelectItem>
                      {parseResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="map-city">City</Label>
                    <Select
                      value={columnMapping.city || "__none__"}
                      onValueChange={(v) => handleMappingChange("city", v)}
                    >
                      <SelectTrigger id="map-city">
                        <SelectValue placeholder="City" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">--</SelectItem>
                        {parseResult.columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="map-state">State</Label>
                    <Select
                      value={columnMapping.state || "__none__"}
                      onValueChange={(v) => handleMappingChange("state", v)}
                    >
                      <SelectTrigger id="map-state">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">--</SelectItem>
                        {parseResult.columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleProceedToReview}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {step === "review" && validationSummary && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Review & Start</h3>
                <p className="text-sm text-muted-foreground">
                  {file?.name}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
                Edit Mapping
              </Button>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Valid prospects</span>
                <Badge
                  variant="secondary"
                  className="bg-green-500/10 text-green-600"
                >
                  <CheckCircle className="mr-1 h-3 w-3" weight="fill" />
                  {validationSummary.valid}
                </Badge>
              </div>

              {validationSummary.invalid > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Invalid (will be skipped)</span>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-500/10 text-yellow-600"
                  >
                    <WarningCircle className="mr-1 h-3 w-3" weight="fill" />
                    {validationSummary.invalid}
                  </Badge>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  {validationSummary.errorSummary}
                </p>
              </div>
            </div>

            {/* Research Info */}
            <div className="rounded-lg border p-4 bg-primary/5">
              <h4 className="text-sm font-medium mb-2">Comprehensive Research</h4>
              <p className="text-xs text-muted-foreground">
                Each prospect will be researched using Perplexity Sonar Pro with grounded citations from:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• Property records (Zillow, county assessors)</li>
                <li>• Business ownership (LinkedIn, state registries)</li>
                <li>• SEC insider filings (if public company executive)</li>
                <li>• FEC political contributions</li>
                <li>• ProPublica nonprofit 990s</li>
              </ul>
            </div>

            {/* Estimated Processing Time */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium mb-2">Estimated Processing Time</h4>
              <p className="text-2xl font-semibold">
                ~{Math.ceil((validationSummary.valid * 30) / 60)} minutes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ~30 seconds per prospect with comprehensive web search
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!validationSummary.canProceed || isCreatingJob}
              >
                {isCreatingJob ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4 animate-spin" />
                    Creating Job...
                  </>
                ) : (
                  <>
                    Start Processing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-4"
        >
          <div className="flex items-start gap-3">
            <WarningCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
