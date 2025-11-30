"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BatchJobProgress } from "@/app/components/batch-processing/batch-job-progress"
import type { BatchProspectJob, BatchProspectItem, BatchJobDetailResponse } from "@/lib/batch-processing"
import { Spinner } from "@phosphor-icons/react"

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
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Job not found"}</p>
        <button
          onClick={handleBack}
          className="text-primary hover:underline"
        >
          Back to Batch Research
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-20 pb-8 sm:pt-8">
      <BatchJobProgress
        job={job}
        items={items}
        onBack={handleBack}
        onRefresh={fetchJobDetails}
      />
    </div>
  )
}
