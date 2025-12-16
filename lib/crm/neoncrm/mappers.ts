/**
 * Neon CRM Data Mappers
 * Transform Neon CRM API responses to normalized format
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import type { NeonCRMAccount, NeonCRMDonation } from "./types"

// ============================================================================
// CONSTITUENT MAPPERS
// ============================================================================

/**
 * Map a Neon CRM account to normalized constituent format
 */
export function mapNeonCRMAccount(account: NeonCRMAccount): NormalizedConstituent {
  const isIndividual = !!account.individualAccount
  const contact = account.individualAccount?.primaryContact
  const company = account.companyAccount
  const addr = isIndividual
    ? contact?.addresses?.[0]
    : company?.addresses?.[0]

  // Build full name
  let fullName = ""
  if (isIndividual && contact) {
    fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
  } else if (company) {
    fullName = company.name || "Unknown Organization"
  }

  return {
    id: `neoncrm-${account.accountId}`,
    externalId: account.accountId || "",
    provider: "neoncrm",

    // Name
    firstName: contact?.firstName,
    lastName: contact?.lastName,
    fullName,

    // Contact
    email: isIndividual ? contact?.email1 : company?.email,
    phone: isIndividual ? contact?.phone1 : company?.phone,

    // Address
    streetAddress: addr?.addressLine1
      ? [addr.addressLine1, addr.addressLine2].filter(Boolean).join(", ")
      : undefined,
    city: addr?.city,
    state: addr?.stateProvince?.code,
    zipCode: addr?.zipCode,
    country: addr?.country?.name,

    // Giving summary
    totalLifetimeGiving: account.donationsSummary?.total,
    lastGiftAmount: account.donationsSummary?.lastDonationAmount,
    lastGiftDate: account.donationsSummary?.lastDonationDate,
    firstGiftDate: account.donationsSummary?.firstDonationDate,
    giftCount: account.donationsSummary?.totalDonations,

    // Custom fields
    customFields: account.accountCustomFields
      ? Object.fromEntries(account.accountCustomFields.map((f) => [f.name, f.value]))
      : undefined,

    // Metadata
    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map multiple Neon CRM accounts to normalized format
 */
export function mapNeonCRMAccounts(accounts: NeonCRMAccount[]): NormalizedConstituent[] {
  return accounts.map(mapNeonCRMAccount)
}

// ============================================================================
// DONATION MAPPERS
// ============================================================================

/**
 * Map a Neon CRM donation to normalized format
 */
export function mapNeonCRMDonation(donation: NeonCRMDonation): NormalizedDonation {
  return {
    id: `neoncrm-${donation.id}`,
    externalId: donation.id || "",
    provider: "neoncrm",
    constituentExternalId: donation.accountId || "",

    amount: donation.amount || 0,
    donationDate: donation.date,
    donationType: donation.donationType,
    campaignName: donation.campaign?.name,
    fundName: donation.fund?.name,
    paymentMethod: donation.payment?.paymentMethod,
    status: donation.status,

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map multiple Neon CRM donations to normalized format
 */
export function mapNeonCRMDonations(donations: NeonCRMDonation[]): NormalizedDonation[] {
  return donations.map(mapNeonCRMDonation)
}
