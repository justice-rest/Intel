/**
 * DonorPerfect Data Mappers
 * Transform DonorPerfect API responses to normalized format
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import type { DonorPerfectDonor, DonorPerfectGift } from "./types"

// ============================================================================
// CONSTITUENT MAPPERS
// ============================================================================

/**
 * Map a DonorPerfect donor to normalized constituent format
 */
export function mapDonorPerfectDonor(donor: DonorPerfectDonor): NormalizedConstituent {
  // Build full name from components
  const nameParts = [donor.first_name, donor.middle_name, donor.last_name].filter(Boolean)
  let fullName = nameParts.join(" ")

  // For organizations, use opt_line as name
  if (donor.org_rec === "Y" && donor.opt_line) {
    fullName = donor.opt_line
  } else if (!fullName && donor.donor_name) {
    fullName = donor.donor_name
  } else if (!fullName) {
    fullName = "Unknown"
  }

  // Build street address
  const streetAddress = [donor.address, donor.address2].filter(Boolean).join(", ") || undefined

  // Determine primary phone (prefer mobile, then home, then business)
  const phone = donor.mobile_phone || donor.home_phone || donor.business_phone || undefined

  // Parse dates from MM/DD/YYYY format
  const parseDate = (dateStr?: string): string | undefined => {
    if (!dateStr) return undefined
    // Try to parse and normalize to ISO format
    try {
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        const [month, day, year] = parts
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }
      return dateStr
    } catch {
      return dateStr
    }
  }

  return {
    id: `donorperfect-${donor.donor_id}`,
    externalId: donor.donor_id,
    provider: "donorperfect",

    // Name
    firstName: donor.first_name,
    lastName: donor.last_name,
    fullName,

    // Contact
    email: donor.email,
    phone,

    // Address
    streetAddress,
    city: donor.city,
    state: donor.state,
    zipCode: donor.zip,
    country: donor.country,

    // Giving summary (these may be populated from summary query)
    totalLifetimeGiving: donor.gift_total,
    largestGift: donor.max_amt,
    lastGiftAmount: donor.last_contrib_amt,
    lastGiftDate: parseDate(donor.last_gift_date || donor.max_date),
    firstGiftDate: parseDate(donor.first_gift_date),
    giftCount: donor.gifts,

    // Custom fields
    customFields: {
      donorType: donor.donor_type,
      orgRec: donor.org_rec,
      optLine: donor.opt_line,
      title: donor.title,
      suffix: donor.suffix,
      salutation: donor.salutation,
      profTitle: donor.prof_title,
      nomail: donor.nomail,
      nomailReason: donor.nomail_reason,
      ytd: donor.ytd,
      lyYtd: donor.ly_ytd,
      avgAmt: donor.avg_amt,
      yrsDonated: donor.yrs_donated,
      narrative: donor.narrative,
    },

    // Metadata
    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map multiple DonorPerfect donors to normalized format
 */
export function mapDonorPerfectDonors(donors: DonorPerfectDonor[]): NormalizedConstituent[] {
  return donors.map(mapDonorPerfectDonor)
}

// ============================================================================
// DONATION MAPPERS
// ============================================================================

/**
 * Map a DonorPerfect gift to normalized donation format
 */
export function mapDonorPerfectGift(gift: DonorPerfectGift): NormalizedDonation {
  // Parse date from MM/DD/YYYY format
  const parseDate = (dateStr?: string): string | undefined => {
    if (!dateStr) return undefined
    try {
      const parts = dateStr.split("/")
      if (parts.length === 3) {
        const [month, day, year] = parts
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }
      return dateStr
    } catch {
      return dateStr
    }
  }

  // Map record type to donation type
  const getDonationType = (recordType?: string): string => {
    switch (recordType) {
      case "G":
        return "Gift"
      case "P":
        return "Pledge"
      case "M":
        return "Split Gift (Main)"
      case "S":
        return "Soft Credit"
      default:
        return recordType || "Gift"
    }
  }

  // Determine status
  const getStatus = (gift: DonorPerfectGift): string => {
    if (gift.record_type === "P") {
      if (gift.balance && gift.balance > 0) {
        return "Pending"
      }
      return "Fulfilled"
    }
    return "Completed"
  }

  return {
    id: `donorperfect-${gift.gift_id}`,
    externalId: gift.gift_id,
    provider: "donorperfect",
    constituentExternalId: gift.donor_id,

    amount: gift.amount || 0,
    donationDate: parseDate(gift.gift_date || gift.gift_date2),
    donationType: getDonationType(gift.record_type),
    campaignName: gift.campaign,
    fundName: gift.gl_code, // DonorPerfect uses GL codes similar to funds
    paymentMethod: gift.gift_type,
    status: getStatus(gift),
    notes: gift.gift_narrative,

    // Custom fields
    customFields: {
      recordType: gift.record_type,
      solicitCode: gift.solicit_code,
      subSolicitCode: gift.sub_solicit_code,
      glCode: gift.gl_code,
      gl: gift.gl,
      splitGift: gift.split_gift,
      pledgePayment: gift.pledge_payment,
      reference: gift.reference,
      transactionId: gift.transaction_id,
      memoryHonor: gift.memory_honor,
      tyLetterNo: gift.ty_letter_no,
      batchNo: gift.batch_no,
      fmv: gift.fmv,
      currency: gift.currency,
      receiptDelivery: gift.receipt_delivery_g,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map multiple DonorPerfect gifts to normalized format
 */
export function mapDonorPerfectGifts(gifts: DonorPerfectGift[]): NormalizedDonation[] {
  return gifts.map(mapDonorPerfectGift)
}
