/**
 * CRM Provider Configuration
 * Defines supported CRM integrations and their API settings
 */

import BloomerangIcon from "@/components/icons/bloomerang"
import VirtuousIcon from "@/components/icons/virtuous"
import NeonCRMIcon from "@/components/icons/neoncrm"
import type { CRMProviderConfig, CRMProvider } from "./types"

// ============================================================================
// CRM PROVIDERS
// ============================================================================

export const CRM_PROVIDERS: CRMProviderConfig[] = [
  {
    id: "bloomerang",
    name: "Bloomerang",
    icon: BloomerangIcon,
    baseUrl: "https://api.bloomerang.co/v2",
    placeholder: "Enter your Bloomerang API key",
    getKeyUrl: "https://bloomerang.co/product/integrations-data-management/api/",
    authHeader: "X-API-Key",
    description: "Connect your Bloomerang CRM to sync constituent and donation data.",
  },
  {
    id: "virtuous",
    name: "Virtuous",
    icon: VirtuousIcon,
    baseUrl: "https://api.virtuoussoftware.com/api",
    placeholder: "Enter your Virtuous API key",
    getKeyUrl: "https://support.virtuous.org/hc/en-us/articles/360052340251-Virtuous-API-Authentication",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    description: "Connect your Virtuous CRM to sync contact and gift data.",
  },
  {
    id: "neoncrm",
    name: "Neon CRM",
    icon: NeonCRMIcon,
    baseUrl: "https://api.neoncrm.com/v2",
    placeholder: "Enter your Neon CRM API key",
    getKeyUrl: "https://developer.neoncrm.com/getting-started/",
    authHeader: "Authorization",
    authType: "basic",
    description: "Connect Neon CRM to sync constituent and donation data.",
    secondaryPlaceholder: "Enter your Neon CRM Org ID",
    secondaryLabel: "Organization ID",
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCRMProvider(providerId: CRMProvider): CRMProviderConfig | undefined {
  return CRM_PROVIDERS.find((p) => p.id === providerId)
}

export function getCRMProviderName(providerId: CRMProvider): string {
  return getCRMProvider(providerId)?.name || providerId
}

export function isCRMProvider(provider: string): provider is CRMProvider {
  return CRM_PROVIDERS.some((p) => p.id === provider)
}

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const CRM_API_CONFIG = {
  // Request timeout in milliseconds
  timeout: 30000,

  // Default pagination settings
  defaultPageSize: 100,
  maxPageSize: 500,

  // Rate limiting (Virtuous has 10,000/hour)
  rateLimitDelay: 100, // ms between requests

  // Retry settings
  maxRetries: 3,
  retryDelay: 1000, // ms
} as const

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

export const CRM_SYNC_CONFIG = {
  // Maximum records to sync per batch
  batchSize: 100,

  // Maximum total records per user (to prevent abuse)
  maxRecordsPerUser: 50000,

  // Minimum time between syncs (in minutes)
  minSyncInterval: 5,

  // Default sync type
  defaultSyncType: "full" as const,
} as const
