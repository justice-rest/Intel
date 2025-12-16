/**
 * Bloomerang Data Mappers
 * Convert Bloomerang API responses to normalized Romy format
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import type { BloomerangConstituent, BloomerangTransaction } from "./types"

/**
 * Map a Bloomerang constituent to normalized format
 */
export function mapBloomerangConstituent(
  constituent: BloomerangConstituent
): Omit<NormalizedConstituent, "id" | "syncedAt"> {
  // Build full name
  let fullName = constituent.FullName
  if (!fullName) {
    if (constituent.Type === "Organization") {
      fullName = constituent.OrganizationName || "Unknown Organization"
    } else {
      fullName = [constituent.FirstName, constituent.LastName].filter(Boolean).join(" ") || "Unknown"
    }
  }

  // Extract primary address
  const address = constituent.PrimaryAddress

  // Extract custom fields into a record
  const customFields: Record<string, unknown> = {}
  if (constituent.CustomFields) {
    for (const field of constituent.CustomFields) {
      customFields[field.FieldName] = field.Value
    }
  }

  // Add constituent type to custom fields
  customFields["constituentType"] = constituent.Type
  customFields["status"] = constituent.Status

  return {
    externalId: constituent.Id.toString(),
    provider: "bloomerang",

    // Name
    firstName: constituent.FirstName,
    lastName: constituent.LastName,
    fullName,

    // Contact
    email: constituent.PrimaryEmail?.Value,
    phone: constituent.PrimaryPhone?.Number,

    // Address
    streetAddress: address?.Street,
    city: address?.City,
    state: address?.State,
    zipCode: address?.PostalCode,
    country: address?.Country,

    // Giving summary
    totalLifetimeGiving: constituent.LifetimeGivingAmount,
    largestGift: constituent.LargestGiftAmount,
    lastGiftAmount: constituent.LastTransactionAmount,
    lastGiftDate: constituent.LastTransactionDate,
    firstGiftDate: constituent.FirstTransactionDate,
    giftCount: constituent.TotalTransactionCount,

    // Custom
    customFields,
  }
}

/**
 * Map a Bloomerang transaction to normalized donation format
 */
export function mapBloomerangTransaction(
  transaction: BloomerangTransaction
): Omit<NormalizedDonation, "id" | "syncedAt"> {
  // Map transaction type
  let donationType: string
  switch (transaction.TransactionType) {
    case "Donation":
      donationType = "one-time"
      break
    case "RecurringDonation":
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
    default:
      donationType = transaction.TransactionType.toLowerCase()
  }

  // Build notes
  const notesParts: string[] = []
  if (transaction.Note) notesParts.push(transaction.Note)
  if (transaction.InHonorOf) notesParts.push(`In honor of: ${transaction.InHonorOf}`)
  if (transaction.InMemoryOf) notesParts.push(`In memory of: ${transaction.InMemoryOf}`)

  // Extract custom fields
  const customFields: Record<string, unknown> = {
    checkNumber: transaction.CheckNumber,
    checkDate: transaction.CheckDate,
    receiptNumber: transaction.ReceiptNumber,
    acknowledgementStatus: transaction.AcknowledgementStatus,
    appealName: transaction.AppealName,
    softCreditAccountId: transaction.SoftCreditAccountId,
  }

  // Remove undefined values
  Object.keys(customFields).forEach((key) => {
    if (customFields[key] === undefined) {
      delete customFields[key]
    }
  })

  return {
    externalId: transaction.Id.toString(),
    provider: "bloomerang",
    constituentExternalId: transaction.AccountId.toString(),

    amount: transaction.Amount,
    donationDate: transaction.Date,
    donationType,
    campaignName: transaction.CampaignName,
    fundName: transaction.FundName,
    paymentMethod: transaction.Method,
    status: transaction.Status.toLowerCase(),
    notes: notesParts.length > 0 ? notesParts.join("\n") : undefined,

    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  }
}

/**
 * Map an array of Bloomerang constituents
 */
export function mapBloomerangConstituents(
  constituents: BloomerangConstituent[]
): Omit<NormalizedConstituent, "id" | "syncedAt">[] {
  return constituents.map(mapBloomerangConstituent)
}

/**
 * Map an array of Bloomerang transactions
 */
export function mapBloomerangTransactions(
  transactions: BloomerangTransaction[]
): Omit<NormalizedDonation, "id" | "syncedAt">[] {
  return transactions.map(mapBloomerangTransaction)
}
