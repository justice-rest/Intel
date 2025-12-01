"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BatchUpload } from "./batch-upload"
import { BatchJobList } from "./batch-job-list"
import { BatchJobProgress } from "./batch-job-progress"
import {
  Plus,
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
  BatchSearchMode,
} from "@/lib/batch-processing"

type View = "list" | "upload" | "detail"

export function BatchSection() {
  const [view, setView] = useState<View>("list")
  const [jobs, setJobs] = useState<BatchProspectJob[]>([])
  const [selectedJob, setSelectedJob] = useState<BatchProspectJob | null>(null)
  const [selectedJobItems, setSelectedJobItems] = useState<BatchProspectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [jobName, setJobName] = useState("")

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

  // Handle upload complete
  const handleUploadComplete = async (
    prospects: ProspectInputData[],
    fileName: string,
    fileSize: number,
    columnMapping: ColumnMapping,
    searchMode: BatchSearchMode
  ) => {
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
          settings: {
            search_mode: searchMode,
          },
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

  // Handle view job
  const handleViewJob = async (job: BatchProspectJob) => {
    setSelectedJob(job)
    await fetchJobDetails(job.id)
    setView("detail")
  }

  // Handle resume job
  const handleResumeJob = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId)
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
    setView("list")
    fetchJobs()
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {/* List View */}
        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Batch Processing</h2>
                <p className="text-sm text-muted-foreground">
                  Research multiple prospects at once
                </p>
              </div>
              <Button onClick={() => setView("upload")} className="gap-2">
                <Plus className="h-4 w-4" />
                New Batch
              </Button>
            </div>

            {/* Job List */}
            <BatchJobList
              jobs={jobs}
              onDelete={handleDeleteJob}
              onView={handleViewJob}
              onResume={handleResumeJob}
              isLoading={isLoading}
            />
          </motion.div>
        )}

        {/* Upload View */}
        {view === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setView("list")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">New Batch Job</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV or Excel file with prospect data
                </p>
              </div>
            </div>

            {/* Job name */}
            <div className="space-y-2">
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

        {/* Detail View */}
        {view === "detail" && selectedJob && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
