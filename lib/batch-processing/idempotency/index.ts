/**
 * Idempotency Module
 *
 * Prevents double-processing of batch items.
 */

export {
  generateIdempotencyKey,
  hashInput,
  withIdempotency,
  DatabaseIdempotencyManager,
  InMemoryIdempotencyManager,
  createIdempotencyManager,
  idempotencyManager,
  type IdempotencyStatus,
  type IdempotencyRecord,
  type IdempotencyCheckResult,
  type IIdempotencyManager,
} from "./keys"
