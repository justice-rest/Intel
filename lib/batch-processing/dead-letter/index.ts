/**
 * Dead Letter Queue Module
 *
 * Captures permanently failed batch items for manual review.
 */

export {
  DatabaseDLQManager,
  InMemoryDLQManager,
  createDLQManager,
  dlqManager,
  type DLQResolution,
  type DeadLetterItem,
  type DLQStats,
  type IDLQManager,
} from "./manager"
