/**
 * Blackbaud SKY API Data Mappers
 * Transform Blackbaud objects to normalized CRM types
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import { safeParseNumber, safeParseDate, safeExternalId } from "../utils"
import type { BlackbaudConstituent, BlackbaudGift } from "./types"

// ============================================================================
// CONSTITUENT MAPPER
// ============================================================================

/**
 * Map Blackbaud Constituent to normalized constituent
 */
export function mapBlackbaudConstituent(constituent: BlackbaudConstituent): NormalizedConstituent {
  // Build full name based on type
  let fullName: string
  let firstName: string | undefined
  let lastName: string | undefined

  if (constituent.type === "Organization") {
    fullName = constituent.org_name || constituent.name || "Unknown Organization"
    firstName = undefined
    lastName = fullName
  } else {
    firstName = constituent.first?.trim() || undefined
    lastName = constituent.last?.trim() || undefined
    fullName = constituent.name ||
      [firstName, constituent.middle, lastName].filter(Boolean).join(" ") ||
      "Unknown"
  }

  // Get primary address
  const primaryAddress = constituent.address ||
    constituent.addresses?.find((a) => a.primary) ||
    constituent.addresses?.[0]

  // Get primary email
  const primaryEmail = constituent.email ||
    constituent.emails?.find((e) => e.primary) ||
    constituent.emails?.[0]

  // Get primary phone
  const primaryPhone = constituent.phone ||
    constituent.phones?.find((p) => p.primary) ||
    constituent.phones?.[0]

  // Get giving summary
  const giving = constituent.giving_summary

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(constituent.id, "bb-con"),
    provider: "blackbaud",

    // Name
    firstName,
    lastName,
    fullName,

    // Contact
    email: primaryEmail?.address || undefined,
    phone: primaryPhone?.number || undefined,

    // Address
    streetAddress: primaryAddress?.address_lines || undefined,
    city: primaryAddress?.city || undefined,
    state: primaryAddress?.state || undefined,
    zipCode: primaryAddress?.postal_code || undefined,
    country: primaryAddress?.country || undefined,

    // Giving summary
    totalLifetimeGiving: safeParseNumber(giving?.total_amount) ||
      safeParseNumber(constituent.lifetime_giving),
    largestGift: safeParseNumber(giving?.largest_gift_amount),
    lastGiftAmount: safeParseNumber(giving?.last_gift_amount),
    lastGiftDate: safeParseDate(giving?.last_gift_date) ||
      safeParseDate(constituent.last_gift_date),
    firstGiftDate: safeParseDate(giving?.first_gift_date) ||
      safeParseDate(constituent.first_gift_date),
    giftCount: safeParseNumber(giving?.total_number_of_gifts),

    // Custom fields
    customFields: {
      blackbaud_type: constituent.type,
      blackbaud_lookup_id: constituent.lookup_id,
      blackbaud_deceased: constituent.deceased,
      blackbaud_birthdate: constituent.birthdate,
      blackbaud_gender: constituent.gender,
      blackbaud_marital_status: constituent.marital_status,
      blackbaud_consecutive_years: giving?.consecutive_years_given,
      blackbaud_average_gift: giving?.average_gift_amount,
      blackbaud_date_added: constituent.date_added,
      blackbaud_date_modified: constituent.date_modified,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of Blackbaud Constituents
 */
export function mapBlackbaudConstituents(constituents: BlackbaudConstituent[]): NormalizedConstituent[] {
  return constituents.map(mapBlackbaudConstituent)
}

// ============================================================================
// GIFT MAPPER
// ============================================================================

/**
 * Map Blackbaud Gift to normalized donation
 */
export function mapBlackbaudGift(gift: BlackbaudGift): NormalizedDonation {
  // Map gift type to donation type
  let donationType: string
  switch (gift.type?.toLowerCase()) {
    case "donation":
      donationType = "Donation"
      break
    case "pledge":
      donationType = "Pledge"
      break
    case "recurringgift":
    case "recurring gift":
      donationType = "Recurring"
      break
    case "grant":
      donationType = "Grant"
      break
    case "stock/property":
      donationType = "Stock"
      break
    case "in-kind":
      donationType = "In-Kind"
      break
    default:
      donationType = gift.type || "Donation"
  }

  // Map post status to normalized status
  let status: string
  switch (gift.post_status?.toLowerCase()) {
    case "posted":
      status = "completed"
      break
    case "not posted":
      status = "pending"
      break
    case "reversed":
      status = "refunded"
      break
    default:
      status = gift.post_status || "pending"
  }

  // Get campaign name from splits or direct
  const campaignName = gift.campaign?.name ||
    gift.gift_splits?.[0]?.campaign?.name

  // Get fund name from splits or direct
  const fundName = gift.fund?.name ||
    gift.gift_splits?.[0]?.fund?.name

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(gift.id, "bb-gift"),
    provider: "blackbaud",
    constituentExternalId: safeExternalId(gift.constituent_id, "bb-con"),

    amount: safeParseNumber(gift.amount?.value) || 0,
    donationDate: safeParseDate(gift.date),
    donationType,
    campaignName,
    fundName,
    paymentMethod: gift.payment_method || undefined,
    status,
    notes: undefined, // Blackbaud doesn't have a direct notes field on gifts

    customFields: {
      blackbaud_lookup_id: gift.lookup_id,
      blackbaud_type: gift.type,
      blackbaud_post_status: gift.post_status,
      blackbaud_post_date: gift.post_date,
      blackbaud_check_number: gift.check_number,
      blackbaud_check_date: gift.check_date,
      blackbaud_receipt_status: gift.receipt_status,
      blackbaud_receipt_date: gift.receipt_date,
      blackbaud_anonymous: gift.is_anonymous,
      blackbaud_fund_id: gift.fund?.id,
      blackbaud_campaign_id: gift.campaign?.id,
      blackbaud_appeal_id: gift.appeal?.id,
      blackbaud_date_added: gift.date_added,
      blackbaud_date_modified: gift.date_modified,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of Blackbaud Gifts
 */
export function mapBlackbaudGifts(gifts: BlackbaudGift[]): NormalizedDonation[] {
  return gifts.map(mapBlackbaudGift)
}
