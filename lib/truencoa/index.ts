/**
 * TrueNCOA Integration Module
 * National Change of Address (NCOA) validation for nonprofit donor data
 *
 * Features:
 * - FREE tier: Validation summary with counts and percentages
 * - PAID tier ($20/file): Full corrected address export
 *
 * @see https://truencoa.com/api/
 */

// Types
export * from "./types"

// Configuration
export {
  TRUENCOA_ENV,
  TRUENCOA_ENDPOINTS,
  TRUENCOA_CONFIG,
  TRUENCOA_PRICING,
  TRUENCOA_BASE_URL,
  getTrueNCOABaseUrl,
  validateCredentialsFormat,
  NCOA_ACTION_DESCRIPTIONS,
  NCOA_MOVE_TYPE_DESCRIPTIONS,
  DPV_INDICATOR_DESCRIPTIONS,
  type TrueNCOAEnvironment,
} from "./config"

// Client
export {
  TrueNCOAClient,
  validateAddresses,
  validateTrueNCOACredentials,
} from "./client"
