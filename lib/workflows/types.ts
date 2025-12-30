/**
 * Workflow Types
 *
 * Shared type definitions for durable workflows.
 * These types ensure consistency across all workflow implementations.
 */

import { z } from "zod"

// ============================================================================
// WORKFLOW STATUS
// ============================================================================

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "retrying"

// ============================================================================
// WORKFLOW RUN
// ============================================================================

export interface WorkflowRun {
  id: string
  workflowName: string
  userId: string
  status: WorkflowStatus
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt: Date
  completedAt?: Date
  createdAt: Date
}

export interface WorkflowStep {
  id: string
  runId: string
  stepName: string
  status: StepStatus
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  retryCount: number
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

// ============================================================================
// WORKFLOW RESULT
// ============================================================================

export interface WorkflowResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  runId?: string
  durationMs?: number
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export type WorkflowFeatureFlag =
  | "durable-crm-sync"
  | "durable-memory-extraction"
  | "durable-deep-research"
  | "durable-batch-processing"

// ============================================================================
// WORKFLOW CONFIG
// ============================================================================

export interface WorkflowConfig {
  /**
   * Whether workflows are enabled globally
   * @default true in development, false in production until stable
   */
  enabled: boolean

  /**
   * Target world for workflow execution
   * - 'local': In-memory execution (development)
   * - 'postgres': Supabase-backed persistence
   * - 'vercel': Vercel managed execution
   */
  targetWorld: "local" | "postgres" | "vercel"

  /**
   * Feature flags for individual workflows
   */
  featureFlags: Record<WorkflowFeatureFlag, boolean>

  /**
   * Percentage of traffic to route through workflows (0-100)
   * Used for gradual rollout
   */
  rolloutPercentage: number
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Common schema for UUID validation
 */
export const UUIDSchema = z.string().uuid()

/**
 * Common schema for non-empty strings
 */
export const NonEmptyStringSchema = z.string().min(1)

/**
 * Workflow run input validation
 */
export const WorkflowRunInputSchema = z.object({
  workflowName: NonEmptyStringSchema,
  userId: UUIDSchema,
  input: z.record(z.unknown()),
})

export type WorkflowRunInput = z.infer<typeof WorkflowRunInputSchema>
