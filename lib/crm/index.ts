/**
 * CRM Integration Module
 * Barrel export for all CRM-related functionality
 */

// Types
export * from "./types"

// Configuration
export {
  CRM_PROVIDERS,
  getCRMProvider,
  getCRMProviderName,
  isCRMProvider,
  CRM_API_CONFIG,
  CRM_SYNC_CONFIG,
  CRM_RATE_LIMITS,
  getProviderRateLimitDelay,
  // Enterprise-grade sync utilities
  shouldAbortSync,
  generateSyncRequestId,
  createSyncLogEntry,
  type SyncProgress,
  type SyncError,
} from "./config"

// Bloomerang
export {
  validateBloomerangKey,
  fetchBloomerangConstituents,
  searchBloomerangConstituents,
  getBloomerangConstituent,
  fetchBloomerangTransactions,
  fetchBloomerangConstituentTransactions,
  fetchAllBloomerangConstituents,
  fetchAllBloomerangTransactions,
} from "./bloomerang/client"
export { mapBloomerangConstituent, mapBloomerangTransaction, mapBloomerangConstituents, mapBloomerangTransactions } from "./bloomerang/mappers"
export type * from "./bloomerang/types"

// Virtuous
export {
  validateVirtuousKey,
  fetchVirtuousContacts,
  searchVirtuousContacts,
  getVirtuousContact,
  fetchVirtuousGifts,
  fetchVirtuousContactGifts,
  fetchAllVirtuousContacts,
  fetchAllVirtuousGifts,
} from "./virtuous/client"
export { mapVirtuousContact, mapVirtuousGift, mapVirtuousContacts, mapVirtuousGifts } from "./virtuous/mappers"
export type * from "./virtuous/types"

// Neon CRM
export {
  validateNeonCRMKey,
  fetchNeonCRMAccounts,
  getNeonCRMAccount,
  searchNeonCRMAccounts,
  fetchAllNeonCRMAccounts,
  fetchNeonCRMAccountDonations,
  searchNeonCRMDonations,
  fetchAllNeonCRMDonations,
  parseNeonCRMCredentials,
  combineNeonCRMCredentials,
} from "./neoncrm/client"
export { mapNeonCRMAccount, mapNeonCRMAccounts, mapNeonCRMDonation, mapNeonCRMDonations } from "./neoncrm/mappers"
export type * from "./neoncrm/types"

// DonorPerfect
export {
  validateDonorPerfectKey,
  searchDonorPerfectDonors,
  getDonorPerfectDonor,
  fetchAllDonorPerfectDonors,
  getDonorPerfectGifts,
  getDonorPerfectGift,
  fetchAllDonorPerfectGifts,
  getDonorPerfectDonorSummary,
} from "./donorperfect/client"
export { mapDonorPerfectDonor, mapDonorPerfectDonors, mapDonorPerfectGift, mapDonorPerfectGifts } from "./donorperfect/mappers"
export type * from "./donorperfect/types"

// Salesforce NPSP
export {
  validateSalesforceKey,
  refreshSalesforceToken,
  fetchSalesforceContacts,
  searchSalesforceContacts,
  getSalesforceContact,
  fetchAllSalesforceContacts,
  fetchSalesforceOpportunities,
  fetchSalesforceContactDonations,
  fetchAllSalesforceOpportunities,
  parseSalesforceCredentials,
  combineSalesforceCredentials,
} from "./salesforce/client"
export { mapSalesforceContact, mapSalesforceContacts, mapSalesforceOpportunity, mapSalesforceOpportunities } from "./salesforce/mappers"
export type * from "./salesforce/types"

// Blackbaud (Raiser's Edge NXT)
export {
  validateBlackbaudKey,
  fetchBlackbaudConstituents,
  searchBlackbaudConstituents,
  getBlackbaudConstituent,
  getBlackbaudGivingSummary,
  fetchAllBlackbaudConstituents,
  fetchBlackbaudGifts,
  fetchBlackbaudConstituentGifts,
  getBlackbaudGift,
  fetchAllBlackbaudGifts,
  parseBlackbaudCredentials,
  combineBlackbaudCredentials,
} from "./blackbaud/client"
export { mapBlackbaudConstituent, mapBlackbaudConstituents, mapBlackbaudGift, mapBlackbaudGifts } from "./blackbaud/mappers"
export type * from "./blackbaud/types"

// EveryAction (NGP VAN)
export {
  validateEveryActionKey,
  fetchEveryActionPeople,
  searchEveryActionPeople,
  getEveryActionPerson,
  findOrCreateEveryActionPerson,
  fetchAllEveryActionPeople,
  fetchEveryActionContributions,
  fetchEveryActionPersonContributions,
  getEveryActionContribution,
  fetchAllEveryActionContributions,
  parseEveryActionCredentials,
  combineEveryActionCredentials,
} from "./everyaction/client"
export { mapEveryActionPerson, mapEveryActionPeople, mapEveryActionContribution, mapEveryActionContributions } from "./everyaction/mappers"
export type * from "./everyaction/types"
