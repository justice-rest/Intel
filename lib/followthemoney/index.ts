/**
 * FollowTheMoney.org API Module
 *
 * 50-state campaign finance data API.
 * Requires API key from https://www.followthemoney.org/login
 */

export {
  getFollowTheMoneyApiKey,
  isFollowTheMoneyEnabled,
  searchByDonorName,
  searchByRecipient,
  FTM_API_BASE,
  FTM_TIMEOUT_MS,
} from "./client"

export type {
  FTMContribution,
  FTMEntity,
  FTMSearchResult,
  FTMApiResponse,
  FTMApiRecord,
} from "./client"
