/**
 * Response Verification Configuration
 *
 * Perplexity Sonar verification for Grok responses
 */

// Feature flag - set to "false" to disable verification
export function isVerificationEnabled(): boolean {
  return process.env.ENABLE_RESPONSE_VERIFICATION !== "false"
}

// Model ID for verification (OpenRouter format)
export const VERIFICATION_MODEL_ID = "perplexity/sonar"

// Minimum response length to trigger verification (characters)
// Shorter responses don't benefit much from verification
export const MIN_RESPONSE_LENGTH_FOR_VERIFICATION = 200

// Maximum response length to send to verification (characters)
// Prevents excessive token costs for very long responses
export const MAX_RESPONSE_LENGTH_FOR_VERIFICATION = 15000

// Models that should trigger verification
export const MODELS_REQUIRING_VERIFICATION = ["openrouter:x-ai/grok-4.1-fast"]

// Max tokens for verification response
export const VERIFICATION_MAX_TOKENS = 8000

// Timeout for verification request (ms)
export const VERIFICATION_TIMEOUT = 60000
