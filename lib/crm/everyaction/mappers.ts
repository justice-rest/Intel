/**
 * EveryAction Data Mappers
 * Transform EveryAction objects to normalized CRM types
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import { safeParseNumber, safeParseDate, safeExternalId } from "../utils"
import type { EveryActionPerson, EveryActionContribution } from "./types"

// ============================================================================
// PERSON MAPPER
// ============================================================================

/**
 * Map EveryAction Person to normalized constituent
 */
export function mapEveryActionPerson(person: EveryActionPerson): NormalizedConstituent {
  // Build full name
  let fullName: string
  let firstName: string | undefined
  let lastName: string | undefined

  if (person.isOrganization && person.organizationName) {
    fullName = person.organizationName
    firstName = undefined
    lastName = fullName
  } else {
    firstName = person.firstName?.trim() || undefined
    lastName = person.lastName?.trim() || undefined
    const middleName = person.middleName?.trim()
    fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || "Unknown"
  }

  // Get preferred or first email
  const preferredEmail = person.emails?.find((e) => e.isPreferred) ||
    person.emails?.[0]

  // Get preferred or first phone
  const preferredPhone = person.phones?.find((p) => p.isPreferred) ||
    person.phones?.[0]

  // Get preferred or first address
  const preferredAddress = person.addresses?.find((a) => a.isPreferred) ||
    person.addresses?.[0]

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(person.vanId, "ea-person"),
    provider: "everyaction",

    // Name
    firstName,
    lastName,
    fullName,

    // Contact
    email: preferredEmail?.email || undefined,
    phone: preferredPhone?.phoneNumber || undefined,

    // Address
    streetAddress: [
      preferredAddress?.addressLine1,
      preferredAddress?.addressLine2,
      preferredAddress?.addressLine3,
    ].filter(Boolean).join(", ") || undefined,
    city: preferredAddress?.city || undefined,
    state: preferredAddress?.stateOrProvince || undefined,
    zipCode: preferredAddress?.zipOrPostalCode || undefined,
    country: preferredAddress?.countryCode || undefined,

    // Giving summary - EveryAction doesn't have built-in rollup fields
    // These would need to be calculated from contributions
    totalLifetimeGiving: undefined,
    largestGift: undefined,
    lastGiftAmount: undefined,
    lastGiftDate: undefined,
    firstGiftDate: undefined,
    giftCount: undefined,

    // Custom fields
    customFields: {
      everyaction_van_id: person.vanId,
      everyaction_nickname: person.nickname,
      everyaction_title: person.title,
      everyaction_suffix: person.suffix,
      everyaction_pronouns: person.pronouns,
      everyaction_dob: person.dateOfBirth,
      everyaction_sex: person.sex,
      everyaction_employer: person.employerName,
      everyaction_job_title: person.jobTitle,
      everyaction_is_org: person.isOrganization,
      everyaction_date_created: person.dateCreated,
      everyaction_date_modified: person.dateModified,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of EveryAction People
 */
export function mapEveryActionPeople(people: EveryActionPerson[]): NormalizedConstituent[] {
  return people.map(mapEveryActionPerson)
}

// ============================================================================
// CONTRIBUTION MAPPER
// ============================================================================

/**
 * Map EveryAction Contribution to normalized donation
 */
export function mapEveryActionContribution(
  contribution: EveryActionContribution
): NormalizedDonation {
  // Map payment type
  let paymentMethod: string | undefined
  switch (contribution.paymentType?.toLowerCase()) {
    case "check":
      paymentMethod = "Check"
      break
    case "cash":
      paymentMethod = "Cash"
      break
    case "creditcard":
    case "credit card":
      paymentMethod = "Credit Card"
      break
    case "ach":
    case "eft":
      paymentMethod = "ACH"
      break
    default:
      paymentMethod = contribution.paymentType
  }

  // Map status
  let status: string
  switch (contribution.status?.toLowerCase()) {
    case "approved":
    case "posted":
      status = "completed"
      break
    case "pending":
      status = "pending"
      break
    case "declined":
    case "rejected":
      status = "declined"
      break
    case "refunded":
      status = "refunded"
      break
    default:
      status = contribution.status || "completed"
  }

  // Determine donation type based on attribution type or other fields
  let donationType = "Donation"
  if (contribution.attributionType) {
    donationType = contribution.attributionType
  } else if (contribution.pledgeId) {
    donationType = "Pledge Payment"
  } else if (contribution.employerMatchingContribution) {
    donationType = "Matching Gift"
  }

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(contribution.contributionId, "ea-contrib"),
    provider: "everyaction",
    constituentExternalId: safeExternalId(contribution.vanId, "ea-person"),

    amount: safeParseNumber(contribution.amount) || 0,
    donationDate: safeParseDate(contribution.dateReceived),
    donationType,
    campaignName: contribution.campaign?.name || undefined,
    fundName: contribution.fund?.name || contribution.designation?.name || undefined,
    paymentMethod,
    status,
    notes: contribution.notes || undefined,

    customFields: {
      everyaction_contribution_id: contribution.contributionId,
      everyaction_van_id: contribution.vanId,
      everyaction_date_thanked: contribution.dateThanked,
      everyaction_date_posted: contribution.datePosted,
      everyaction_check_number: contribution.checkNumber,
      everyaction_cc_last4: contribution.creditCardLast4,
      everyaction_batch_code: contribution.batchCode,
      everyaction_batch_number: contribution.batchNumber,
      everyaction_ack_status: contribution.acknowledgementStatus,
      everyaction_ack_date: contribution.acknowledgementDate,
      everyaction_pledge_id: contribution.pledgeId,
      everyaction_linked_id: contribution.linkedContributionId,
      everyaction_matching_id: contribution.matchingContributionId,
      everyaction_employer_match: contribution.employerMatchingContribution,
      everyaction_designation_id: contribution.designation?.designationId,
      everyaction_fund_id: contribution.fund?.fundId,
      everyaction_campaign_id: contribution.campaign?.campaignId,
      everyaction_codes: contribution.codes?.map((c) => c.name),
      everyaction_date_created: contribution.dateCreated,
      everyaction_date_modified: contribution.dateModified,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of EveryAction Contributions
 */
export function mapEveryActionContributions(
  contributions: EveryActionContribution[]
): NormalizedDonation[] {
  return contributions.map(mapEveryActionContribution)
}
