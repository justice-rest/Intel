/**
 * Email Module
 * Re-exports email utilities and templates
 */

export { sendEmail, isEmailEnabled } from "./resend"
export type { SendEmailOptions } from "./resend"

export {
  getBatchCompleteEmailHtml,
  getBatchCompleteEmailSubject,
} from "./templates/batch-complete"
export type { BatchCompleteEmailData } from "./templates/batch-complete"

export {
  getDataExportEmailHtml,
  getDataExportEmailSubject,
  getAccountDeletionEmailHtml,
  getAccountDeletionEmailSubject,
} from "./templates/gdpr-emails"
export type {
  DataExportEmailData,
  AccountDeletionEmailData,
} from "./templates/gdpr-emails"

export {
  getShareConversationEmailHtml,
  getShareConversationEmailSubject,
} from "./templates/share-conversation"
export type { ShareConversationEmailData } from "./templates/share-conversation"

// Onboarding email sequence
export {
  sendWelcomeEmail,
  sendHowItWorksEmail,
  sendCommonChallengesEmail,
  sendMovingForwardEmail,
  scheduleOnboardingSequence,
} from "./onboarding"

export {
  getWelcomeEmailHtml,
  getWelcomeEmailSubject,
  getHowItWorksEmailHtml,
  getHowItWorksEmailSubject,
  getCommonChallengesEmailHtml,
  getCommonChallengesEmailSubject,
  getMovingForwardEmailHtml,
  getMovingForwardEmailSubject,
} from "./templates/onboarding"
export type { OnboardingEmailData } from "./templates/onboarding"
