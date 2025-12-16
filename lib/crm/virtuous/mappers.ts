/**
 * Virtuous Data Mappers
 * Convert Virtuous API responses to normalized Romy format
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import type { VirtuousContact, VirtuousGift } from "./types"

/**
 * Map a Virtuous contact to normalized format
 */
export function mapVirtuousContact(
  contact: VirtuousContact
): Omit<NormalizedConstituent, "id" | "syncedAt"> {
  // Build full name
  let fullName = contact.name
  if (!fullName) {
    if (contact.contactType === "Organization") {
      fullName = contact.organizationName || "Unknown Organization"
    } else {
      fullName =
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"
    }
  }

  // Extract address
  const address = contact.address

  // Extract custom fields into a record
  const customFields: Record<string, unknown> = {}
  if (contact.customFields) {
    for (const field of contact.customFields) {
      customFields[field.name] = field.value
    }
  }

  // Add contact type and engagement to custom fields
  customFields["contactType"] = contact.contactType
  customFields["engagementScore"] = contact.engagementScore
  customFields["referenceSource"] = contact.referenceSource
  customFields["tags"] = contact.tags

  // Remove undefined values
  Object.keys(customFields).forEach((key) => {
    if (customFields[key] === undefined) {
      delete customFields[key]
    }
  })

  return {
    externalId: contact.id.toString(),
    provider: "virtuous",

    // Name
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName,

    // Contact
    email: contact.primaryEmail,
    phone: contact.primaryPhone,

    // Address
    streetAddress: address?.address1
      ? [address.address1, address.address2].filter(Boolean).join(", ")
      : undefined,
    city: address?.city,
    state: address?.state,
    zipCode: address?.postal,
    country: address?.country,

    // Giving summary
    totalLifetimeGiving: contact.lifetimeGiving,
    largestGift: undefined, // Virtuous doesn't provide this directly
    lastGiftAmount: contact.lastGiftAmount,
    lastGiftDate: contact.lastGiftDate,
    firstGiftDate: contact.firstGiftDate,
    giftCount: contact.totalGifts,

    // Custom
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  }
}

/**
 * Map a Virtuous gift to normalized donation format
 */
export function mapVirtuousGift(
  gift: VirtuousGift
): Omit<NormalizedDonation, "id" | "syncedAt"> {
  // Map gift type
  let donationType: string
  switch (gift.giftType) {
    case "Donation":
      donationType = "one-time"
      break
    case "RecurringGift":
      donationType = "recurring"
      break
    case "Pledge":
      donationType = "pledge"
      break
    case "PledgePayment":
      donationType = "pledge-payment"
      break
    case "Grant":
      donationType = "grant"
      break
    case "InKind":
      donationType = "in-kind"
      break
    case "Stock":
      donationType = "stock"
      break
    default:
      donationType = String(gift.giftType).toLowerCase()
  }

  // Map status
  let status: string
  switch (gift.state) {
    case "Posted":
      status = "posted"
      break
    case "Pending":
      status = "pending"
      break
    case "Refunded":
      status = "refunded"
      break
    case "Reversed":
      status = "reversed"
      break
    case "Cancelled":
      status = "cancelled"
      break
    default:
      status = gift.state ? String(gift.state).toLowerCase() : "unknown"
  }

  // Extract custom fields
  const customFields: Record<string, unknown> = {
    segment: gift.segment,
    segmentId: gift.segmentId,
    appeal: gift.appeal,
    appealId: gift.appealId,
    transactionSource: gift.transactionSource,
    transactionId: gift.transactionId,
    batch: gift.batch,
    batchNumber: gift.batchNumber,
    acknowledgementStatus: gift.acknowledgementStatus,
    acknowledgedDate: gift.acknowledgedDate,
    isTaxDeductible: gift.isTaxDeductible,
    receiptNumber: gift.receiptNumber,
    receiptDate: gift.receiptDate,
    softCredits: gift.softCredits,
  }

  // Remove undefined values
  Object.keys(customFields).forEach((key) => {
    if (customFields[key] === undefined) {
      delete customFields[key]
    }
  })

  return {
    externalId: gift.id.toString(),
    provider: "virtuous",
    constituentExternalId: gift.contactId.toString(),

    amount: gift.amount,
    donationDate: gift.giftDate,
    donationType,
    campaignName: gift.segment, // Virtuous uses "segment" for campaigns
    fundName: gift.project, // Virtuous uses "project" for funds
    paymentMethod: gift.paymentType,
    status,
    notes: gift.notes,

    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  }
}

/**
 * Map an array of Virtuous contacts
 */
export function mapVirtuousContacts(
  contacts: VirtuousContact[]
): Omit<NormalizedConstituent, "id" | "syncedAt">[] {
  return contacts.map(mapVirtuousContact)
}

/**
 * Map an array of Virtuous gifts
 */
export function mapVirtuousGifts(
  gifts: VirtuousGift[]
): Omit<NormalizedDonation, "id" | "syncedAt">[] {
  return gifts.map(mapVirtuousGift)
}
