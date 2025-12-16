/**
 * CRM Integration Module
 * Barrel export for all CRM-related functionality
 */

// Types
export * from "./types"

// Configuration
export { CRM_PROVIDERS, getCRMProvider, getCRMProviderName, isCRMProvider, CRM_API_CONFIG, CRM_SYNC_CONFIG } from "./config"

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
