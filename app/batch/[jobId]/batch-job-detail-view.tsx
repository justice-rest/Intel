"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BatchJobProgress } from "@/app/components/batch-processing/batch-job-progress"
import type { BatchProspectJob, BatchProspectItem, BatchJobDetailResponse } from "@/lib/batch-processing"
import { Spinner } from "@phosphor-icons/react"
import "@/app/batch/batch-dashboard.css"

interface BatchJobDetailViewProps {
  jobId: string
}

export function BatchJobDetailView({ jobId }: BatchJobDetailViewProps) {
  const router = useRouter()
  const [job, setJob] = useState<BatchProspectJob | null>(null)
  const [items, setItems] = useState<BatchProspectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/batch-prospects/${jobId}?include_items=true`)
      if (!response.ok) {
        if (response.status === 404) {
          setError("Batch job not found")
          return
        }
        throw new Error("Failed to fetch job details")
      }
      const data: BatchJobDetailResponse = await response.json()
      setJob(data.job)
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job")
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJobDetails()
  }, [fetchJobDetails])

  const handleBack = () => {
    router.push("/batch")
  }

  if (isLoading) {
    return (
      <div className="batch-app-container">
        <header className="batch-header">
          <div className="batch-header-left">
            <a href="/" className="batch-logo-link">
              <img src="/PFPs/1.png" alt="Rōmy" className="batch-logo" />
              <span className="batch-logo-text">Rōmy</span>
            </a>
            <span className="batch-header-divider">/</span>
            <a href="/batch" className="batch-nav-link">Batch Research</a>
          </div>
        </header>
        <div className="flex h-[60vh] items-center justify-center">
          <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="batch-app-container">
        <header className="batch-header">
          <div className="batch-header-left">
            <a href="/" className="batch-logo-link">
              <img src="/PFPs/1.png" alt="Rōmy" className="batch-logo" />
              <span className="batch-logo-text">Rōmy</span>
            </a>
            <span className="batch-header-divider">/</span>
            <a href="/batch" className="batch-nav-link">Batch Research</a>
          </div>
        </header>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">{error || "Job not found"}</p>
          <button
            onClick={handleBack}
            className="text-primary hover:underline"
          >
            Back to Batch Research
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="batch-app-container">
      {/* Header */}
      <header className="batch-header">
        <div className="batch-header-left">
          <a href="/" className="batch-logo-link">
            <img src="/PFPs/1.png" alt="Rōmy" className="batch-logo" />
            <span className="batch-logo-text">Rōmy</span>
          </a>
          <span className="batch-header-divider">/</span>
          <a href="/batch" className="batch-nav-link">Batch Research</a>
          <span className="batch-header-divider">/</span>
          <h1>{job.name}</h1>
        </div>
        <div className="batch-header-right">
          <a href="/batch" className="flat-button">
            All Batches
          </a>
        </div>
      </header>

      <div className="batch-detail-content">
        <BatchJobProgress
          job={job}
          items={items}
          onBack={handleBack}
          onRefresh={fetchJobDetails}
        />
      </div>
    </div>
  )
}
