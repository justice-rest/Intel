/**
 * Knowledge System
 *
 * Main exports for the organizational knowledge system.
 * Transforms Rōmy from a generic AI into a personalized organizational fundraiser.
 */

// Types
export * from './types'

// Configuration
export * from './config'

// Prompt Generation
export {
  getKnowledgePromptForUser,
  generateKnowledgePrompt,
} from './prompt-generator'

// Document Processors
export {
  analyzeDocument,
  classifyDocumentPurpose,
  type AnalyzeDocumentOptions,
  type AnalyzeDocumentResult,
} from './processors'
