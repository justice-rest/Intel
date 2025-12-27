/**
 * Salesforce NPSP Data Mappers
 * Transform Salesforce objects to normalized CRM types
 */

import type { NormalizedConstituent, NormalizedDonation } from "../types"
import { safeParseNumber, safeParseDate, safeExternalId } from "../utils"
import type { SalesforceContact, SalesforceOpportunity } from "./types"

// ============================================================================
// CONTACT MAPPER
// ============================================================================

/**
 * Map Salesforce Contact to normalized constituent
 */
export function mapSalesforceContact(contact: SalesforceContact): NormalizedConstituent {
  // Build full name
  const firstName = contact.FirstName?.trim() || ""
  const lastName = contact.LastName?.trim() || ""
  const fullName = contact.Name || `${firstName} ${lastName}`.trim() || "Unknown"

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(contact.Id, "sf-contact"),
    provider: "salesforce",

    // Name
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName,

    // Contact
    email: contact.Email?.trim() || undefined,
    phone: contact.Phone?.trim() || contact.MobilePhone?.trim() || contact.HomePhone?.trim() || undefined,

    // Address (mailing address)
    streetAddress: contact.MailingStreet?.trim() || undefined,
    city: contact.MailingCity?.trim() || undefined,
    state: contact.MailingState?.trim() || undefined,
    zipCode: contact.MailingPostalCode?.trim() || undefined,
    country: contact.MailingCountry?.trim() || undefined,

    // Giving summary (NPSP rollup fields)
    totalLifetimeGiving: safeParseNumber(contact.npo02__TotalOppAmount__c),
    largestGift: safeParseNumber(contact.npo02__LargestAmount__c),
    lastGiftAmount: safeParseNumber(contact.npo02__LastOppAmount__c),
    lastGiftDate: safeParseDate(contact.npo02__LastCloseDate__c),
    firstGiftDate: safeParseDate(contact.npo02__FirstCloseDate__c),
    giftCount: safeParseNumber(contact.npo02__NumberOfClosedOpps__c),

    // Custom fields for Salesforce-specific data
    customFields: {
      salesforce_account_id: contact.AccountId,
      salesforce_average_gift: contact.npo02__AverageAmount__c,
      salesforce_smallest_gift: contact.npo02__SmallestAmount__c,
      salesforce_created_date: contact.CreatedDate,
      salesforce_modified_date: contact.LastModifiedDate,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of Salesforce Contacts
 */
export function mapSalesforceContacts(contacts: SalesforceContact[]): NormalizedConstituent[] {
  return contacts.map(mapSalesforceContact)
}

// ============================================================================
// OPPORTUNITY MAPPER
// ============================================================================

/**
 * Map Salesforce Opportunity to normalized donation
 */
export function mapSalesforceOpportunity(
  opportunity: SalesforceOpportunity
): NormalizedDonation {
  // Determine constituent ID from various fields
  const constituentId =
    opportunity.npsp__Primary_Contact__c ||
    opportunity.ContactId ||
    opportunity.AccountId ||
    ""

  // Map stage to status
  let status: string
  switch (opportunity.StageName) {
    case "Closed Won":
      status = "completed"
      break
    case "Closed Lost":
      status = "declined"
      break
    case "Pledged":
      status = "pledged"
      break
    default:
      status = opportunity.StageName?.toLowerCase() || "pending"
  }

  // Map opportunity type to donation type
  let donationType: string
  switch (opportunity.Type?.toLowerCase()) {
    case "donation":
    case "individual":
      donationType = "Individual"
      break
    case "grant":
    case "foundation":
      donationType = "Grant"
      break
    case "major gift":
      donationType = "Major Gift"
      break
    case "corporate":
      donationType = "Corporate"
      break
    case "event":
      donationType = "Event"
      break
    case "in-kind":
      donationType = "In-Kind"
      break
    default:
      donationType = opportunity.Type || "Donation"
  }

  return {
    id: "", // Will be set by database
    externalId: safeExternalId(opportunity.Id, "sf-opp"),
    provider: "salesforce",
    constituentExternalId: safeExternalId(constituentId, "sf-contact"),

    amount: safeParseNumber(opportunity.Amount) || 0,
    donationDate: safeParseDate(opportunity.CloseDate),
    donationType,
    campaignName: opportunity.Campaign?.Name || undefined,
    fundName: undefined, // Salesforce uses campaigns, not funds
    paymentMethod: opportunity.npe01__Payment_Method__c || undefined,
    status,
    notes: opportunity.Description || undefined,

    customFields: {
      salesforce_opportunity_name: opportunity.Name,
      salesforce_account_id: opportunity.AccountId,
      salesforce_campaign_id: opportunity.CampaignId,
      salesforce_stage: opportunity.StageName,
      salesforce_type: opportunity.Type,
      salesforce_created_date: opportunity.CreatedDate,
      salesforce_modified_date: opportunity.LastModifiedDate,
    },

    syncedAt: new Date().toISOString(),
  }
}

/**
 * Map array of Salesforce Opportunities
 */
export function mapSalesforceOpportunities(
  opportunities: SalesforceOpportunity[]
): NormalizedDonation[] {
  return opportunities.map(mapSalesforceOpportunity)
}
