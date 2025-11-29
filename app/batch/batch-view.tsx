"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { BatchUpload } from "@/app/components/batch-processing/batch-upload"
import { BatchJobProgress } from "@/app/components/batch-processing/batch-job-progress"
import { BatchJobList } from "@/app/components/batch-processing/batch-job-list"
import { cn } from "@/lib/utils"
import {
  UsersThree,
  ArrowUpRight,
  Upload,
  Plus,
  FileText,
  ArrowLeft,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import type {
  BatchProspectJob,
  BatchProspectItem,
  ProspectInputData,
  ColumnMapping,
  CreateBatchJobResponse,
  BatchJobDetailResponse,
} from "@/lib/batch-processing"
import { useUser } from "@/lib/user-store/provider"

type View = "home" | "upload" | "manual" | "detail"

const DEFAULT_BATCH_LIMIT = 10

export function BatchView() {
  const [view, setView] = useState<View>("home")
  const [jobs, setJobs] = useState<BatchProspectJob[]>([])
  const [selectedJob, setSelectedJob] = useState<BatchProspectJob | null>(null)
  const [selectedJobItems, setSelectedJobItems] = useState<BatchProspectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [jobName, setJobName] = useState("")
  const [manualInput, setManualInput] = useState("")
  const [batchLimit, setBatchLimit] = useState(DEFAULT_BATCH_LIMIT)
  const [planName, setPlanName] = useState("growth")
  const { user } = useUser()

  // Fetch user's plan and set batch limit
  useEffect(() => {
    async function fetchPlanLimit() {
      try {
        const response = await fetch("/api/batch-prospects/limits")
        if (response.ok) {
          const data = await response.json()
          setBatchLimit(data.limit)
          setPlanName(data.plan)
        }
      } catch (error) {
        console.error("Failed to fetch plan:", error)
      }
    }

    fetchPlanLimit()
  }, [user?.id])

  // Fetch jobs on mount
  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/batch-prospects")
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Fetch job details
  const fetchJobDetails = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/batch-prospects/${jobId}?include_items=true`)
      if (response.ok) {
        const data: BatchJobDetailResponse = await response.json()
        setSelectedJob(data.job)
        setSelectedJobItems(data.items)
      }
    } catch (error) {
      console.error("Failed to fetch job details:", error)
    }
  }, [])

  // Handle file upload complete
  const handleUploadComplete = async (
    prospects: ProspectInputData[],
    fileName: string,
    fileSize: number,
    columnMapping: ColumnMapping
  ) => {
    // Check batch limit
    if (prospects.length > batchLimit) {
      alert(`Your plan allows up to ${batchLimit} prospects per batch. You uploaded ${prospects.length}. Please upgrade your plan or reduce the number of prospects.`)
      return
    }

    setIsCreatingJob(true)

    try {
      const response = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: jobName || `Batch ${new Date().toLocaleDateString()}`,
          prospects,
          column_mapping: columnMapping,
          source_file_name: fileName,
          source_file_size: fileSize,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create job")
      }

      const data: CreateBatchJobResponse = await response.json()

      // Navigate to job detail
      setSelectedJob(data.job)
      await fetchJobDetails(data.job.id)
      setView("detail")
      setJobName("")

      // Refresh job list
      fetchJobs()
    } catch (error) {
      console.error("Failed to create job:", error)
      alert(error instanceof Error ? error.message : "Failed to create batch job")
    } finally {
      setIsCreatingJob(false)
    }
  }

  // Handle manual text input submission
  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return

    // Parse manual input - each line is a prospect
    const lines = manualInput.trim().split("\n").filter(line => line.trim())

    if (lines.length > batchLimit) {
      alert(`Your plan allows up to ${batchLimit} prospects per batch. You entered ${lines.length}. Please upgrade your plan or reduce the number of prospects.`)
      return
    }

    if (lines.length < 2) {
      alert("Please enter at least 2 prospects for batch processing.")
      return
    }

    const prospects: ProspectInputData[] = lines.map(line => {
      // Try to parse "Name, Address" format
      const parts = line.split(",").map(p => p.trim())
      if (parts.length >= 2) {
        return {
          name: parts[0],
          full_address: parts.slice(1).join(", "),
        }
      }
      // Just a name
      return { name: line.trim() }
    })

    setIsCreatingJob(true)

    try {
      const response = await fetch("/api/batch-prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: jobName || `Manual Batch ${new Date().toLocaleDateString()}`,
          prospects,
          column_mapping: { name: "name", full_address: "full_address" },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create job")
      }

      const data: CreateBatchJobResponse = await response.json()

      setSelectedJob(data.job)
      await fetchJobDetails(data.job.id)
      setView("detail")
      setJobName("")
      setManualInput("")

      fetchJobs()
    } catch (error) {
      console.error("Failed to create job:", error)
      alert(error instanceof Error ? error.message : "Failed to create batch job")
    } finally {
      setIsCreatingJob(false)
    }
  }

  // Handle view job
  const handleViewJob = async (job: BatchProspectJob) => {
    setSelectedJob(job)
    await fetchJobDetails(job.id)
    setView("detail")
  }

  // Handle resume job (by jobId)
  const handleResumeJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (job) {
      await handleViewJob(job)
    }
  }

  // Handle delete job
  const handleDeleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/batch-prospects/${jobId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId))
      }
    } catch (error) {
      console.error("Failed to delete job:", error)
    }
  }

  // Handle back from detail
  const handleBack = () => {
    setSelectedJob(null)
    setSelectedJobItems([])
    setView("home")
    fetchJobs()
  }

  // Onboarding-style button
  const OnboardingButton = ({
    children,
    onClick,
    disabled = false,
    className = "",
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      className={cn(
        "group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]",
        className
      )}
    >
      {children}
      <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
        <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
      </div>
    </Button>
  )

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto">
      <AnimatePresence mode="wait">
        {/* Home View */}
        {view === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mx-auto px-4 pt-16"
          >
            {/* Header */}
            <div className="mb-8 flex items-center justify-center gap-2">
              <UsersThree className="text-muted-foreground" size={28} />
              <h1 className="text-center text-3xl font-medium tracking-tight">
                Batch Research
              </h1>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-center mb-8">
              Research multiple prospects at once. Upload a CSV file or enter names manually.
            </p>

            {/* Plan limit badge */}
            <div className="flex justify-center mb-8">
              <Badge variant="secondary" className="px-3 py-1 capitalize">
                {planName} Plan: Up to {batchLimit} prospects per batch
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <OnboardingButton onClick={() => setView("upload")}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV File
              </OnboardingButton>
              <OnboardingButton onClick={() => setView("manual")}>
                <FileText className="mr-2 h-4 w-4" />
                Enter Manually
              </OnboardingButton>
            </div>

            {/* Recent jobs */}
            <div className="mt-8">
              <h2 className="text-lg font-medium mb-4">Recent Batch Jobs</h2>
              <BatchJobList
                jobs={jobs}
                onDelete={handleDeleteJob}
                onView={handleViewJob}
                onResume={handleResumeJob}
                isLoading={isLoading}
              />
            </div>
          </motion.div>
        )}

        {/* Upload View */}
        {view === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mx-auto px-4 pt-8"
          >
            {/* Header with back */}
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setView("home")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">Upload Prospect File</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV or Excel file with prospect data (max {batchLimit} rows)
                </p>
              </div>
            </div>

            {/* Job name */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium">Job Name</label>
              <Input
                placeholder="e.g., Q4 Prospect Research"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>

            {/* Upload component */}
            <BatchUpload
              onUploadComplete={handleUploadComplete}
              isCreatingJob={isCreatingJob}
            />
          </motion.div>
        )}

        {/* Manual Entry View */}
        {view === "manual" && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mx-auto px-4 pt-8"
          >
            {/* Header with back */}
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setView("home")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">Enter Prospects Manually</h2>
                <p className="text-sm text-muted-foreground">
                  Enter one prospect per line. Format: Name, Address (address optional)
                </p>
              </div>
            </div>

            {/* Job name */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">Job Name</label>
              <Input
                placeholder="e.g., Board Member Research"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>

            {/* Manual input */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium">Prospects (one per line)</label>
              <Textarea
                placeholder={`John Smith, 123 Main St, New York, NY
Jane Doe, 456 Oak Ave, Los Angeles, CA
Robert Johnson`}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {manualInput.trim().split("\n").filter(l => l.trim()).length} / {batchLimit} prospects
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <OnboardingButton
                onClick={handleManualSubmit}
                disabled={isCreatingJob || !manualInput.trim()}
              >
                {isCreatingJob ? "Creating..." : "Start Research"}
              </OnboardingButton>
            </div>
          </motion.div>
        )}

        {/* Detail View */}
        {view === "detail" && selectedJob && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl mx-auto px-4 pt-8"
          >
            <BatchJobProgress
              job={selectedJob}
              items={selectedJobItems}
              onBack={handleBack}
              onRefresh={() => fetchJobDetails(selectedJob.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
