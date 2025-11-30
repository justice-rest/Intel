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
