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
  getKnowledgePromptForProfile,
  combinePromptSections,
  truncateToTokens,
} from './prompt-generator'

// Chat-Scoped Knowledge
export {
  getChatScopedProfile,
  createChatScopedProfile,
  updateChatScopedProfile,
  removeChatScopedProfile,
} from './chat-scoped'

// Document Processors
export {
  analyzeDocument,
  classifyDocumentPurpose,
  type AnalyzeDocumentOptions,
  type AnalyzeDocumentResult,
} from './processors'
