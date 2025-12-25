/**
 * Provenance Tracking Module
 *
 * Full audit trail for every data field extracted during research.
 */

export {
  DatabaseProvenanceManager,
  InMemoryProvenanceManager,
  createProvenanceManager,
  provenanceManager,
  type ProvenanceRecord,
  type ProvenanceInput,
  type AuditReport,
  type IProvenanceManager,
} from "./manager"
