/**
 * GDPR Compliance Module
 * Data export and account deletion functionality
 */

// Types
export type {
  ExportSection,
  ExportOptions,
  ExportData,
  ExportChat,
  ExportMessage,
  ExportAttachment,
  ExportMemory,
  ExportConstituent,
  ExportDonation,
  DeletionRequest,
  DeletionResult,
  DeletionErrorCode,
  DeletionPreCheck,
  SubscriptionStatus,
} from './types'

// Export functions
export { gatherExportData, estimateExportSize } from './export'

// Deletion functions
export {
  validateDeletionRequest,
  checkDeletionPrerequisites,
  getSubscriptionStatus,
  executeAccountDeletion,
  getDeletionSummary,
} from './deletion'

// Storage cleanup
export { deleteUserStorageFiles, getUserStorageStats } from './storage-cleanup'
