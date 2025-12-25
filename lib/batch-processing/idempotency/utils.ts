/**
 * Idempotency Utilities (Client-safe)
 *
 * Pure functions for generating idempotency keys.
 * Does not import any server-only dependencies.
 */

import { createHash } from "crypto"

/**
 * Generate a unique idempotency key for a processing step
 */
export function generateIdempotencyKey(
  itemId: string,
  stepName: string,
  inputHash: string
): string {
  const combined = `${itemId}:${stepName}:${inputHash}`
  return createHash("sha256").update(combined).digest("hex")
}

/**
 * Hash input data for idempotency key generation
 */
export function hashInput(input: unknown): string {
  const json = JSON.stringify(input, Object.keys(input as object).sort())
  return createHash("sha256").update(json).digest("hex").slice(0, 16)
}
