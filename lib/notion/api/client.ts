/**
 * Notion API Client
 *
 * Handles API requests to Notion for searching pages, getting page content, and fetching blocks.
 */

import {
  NOTION_OAUTH_CONFIG,
  NOTION_RATE_LIMITS,
  NOTION_ERROR_MESSAGES,
  calculateRetryDelay,
} from "../config"
import type {
  NotionSearchResponse,
  NotionPage,
  NotionDatabase,
  NotionBlocksResponse,
  NotionBlock,
} from "../types"
import { NotionApiError, NotionTokenError } from "../types"

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Make an authenticated request to the Notion API
 */
async function makeRequest<T>(
  accessToken: string,
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const { method = "GET", body } = options

  const response = await fetch(`${NOTION_OAUTH_CONFIG.apiBaseUrl}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_OAUTH_CONFIG.apiVersion,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(NOTION_OAUTH_CONFIG.timeout),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))

    // Check for token revocation
    if (response.status === 401) {
      throw new NotionTokenError(NOTION_ERROR_MESSAGES.tokenRevoked, true)
    }

    // Check for rate limiting
    if (response.status === 429) {
      throw new NotionApiError(
        NOTION_ERROR_MESSAGES.rateLimited,
        429,
        "rate_limited",
        true // retryable
      )
    }

    // Check for access denied
    if (response.status === 403) {
      throw new NotionApiError(
        NOTION_ERROR_MESSAGES.pageNotAccessible,
        403,
        errorData.code,
        false
      )
    }

    throw new NotionApiError(
      errorData.message || `Request failed: ${response.statusText}`,
      response.status,
      errorData.code,
      response.status >= 500 // Server errors are retryable
    )
  }

  return response.json()
}

/**
 * Make a request with retry logic for rate limiting
 */
async function makeRequestWithRetry<T>(
  accessToken: string,
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < NOTION_RATE_LIMITS.maxRetriesOnRateLimit; attempt++) {
    try {
      // Add delay between requests to respect rate limits
      if (attempt > 0) {
        await sleep(calculateRetryDelay(attempt))
      }

      return await makeRequest<T>(accessToken, endpoint, options)
    } catch (error) {
      lastError = error as Error

      // Don't retry non-retryable errors
      if (error instanceof NotionApiError && !error.retryable) {
        throw error
      }

      // Don't retry token errors
      if (error instanceof NotionTokenError) {
        throw error
      }

      // Wait before retry
      await sleep(calculateRetryDelay(attempt))
    }
  }

  throw lastError || new Error("Request failed after retries")
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search for pages and databases
 */
export async function searchPages(
  accessToken: string,
  options: {
    query?: string
    filter?: {
      property: "object"
      value: "page" | "database"
    }
    sort?: {
      direction: "ascending" | "descending"
      timestamp: "last_edited_time"
    }
    startCursor?: string
    pageSize?: number
  } = {}
): Promise<NotionSearchResponse> {
  const { query, filter, sort, startCursor, pageSize = 100 } = options

  const body: Record<string, unknown> = {
    page_size: Math.min(pageSize, 100),
  }

  if (query) {
    body.query = query
  }

  if (filter) {
    body.filter = filter
  }

  if (sort) {
    body.sort = sort
  }

  if (startCursor) {
    body.start_cursor = startCursor
  }

  return makeRequestWithRetry<NotionSearchResponse>(accessToken, "/search", {
    method: "POST",
    body,
  })
}

/**
 * Get all pages (with pagination)
 */
export async function getAllPages(
  accessToken: string,
  options: {
    query?: string
    maxPages?: number
  } = {}
): Promise<(NotionPage | NotionDatabase)[]> {
  const { query, maxPages = 100 } = options
  const results: (NotionPage | NotionDatabase)[] = []
  let cursor: string | undefined

  while (results.length < maxPages) {
    const response = await searchPages(accessToken, {
      query,
      startCursor: cursor,
      pageSize: Math.min(100, maxPages - results.length),
    })

    results.push(...response.results)

    if (!response.has_more || !response.next_cursor) {
      break
    }

    cursor = response.next_cursor

    // Rate limit delay
    await sleep(NOTION_RATE_LIMITS.delayBetweenRequests)
  }

  return results
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

/**
 * Get a page by ID
 */
export async function getPage(
  accessToken: string,
  pageId: string
): Promise<NotionPage> {
  return makeRequestWithRetry<NotionPage>(accessToken, `/pages/${pageId}`)
}

/**
 * Get a database by ID
 */
export async function getDatabase(
  accessToken: string,
  databaseId: string
): Promise<NotionDatabase> {
  return makeRequestWithRetry<NotionDatabase>(accessToken, `/databases/${databaseId}`)
}

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

/**
 * Get children blocks of a block/page
 */
export async function getBlocks(
  accessToken: string,
  blockId: string,
  options: {
    startCursor?: string
    pageSize?: number
  } = {}
): Promise<NotionBlocksResponse> {
  const { startCursor, pageSize = 100 } = options

  let endpoint = `/blocks/${blockId}/children?page_size=${Math.min(pageSize, 100)}`
  if (startCursor) {
    endpoint += `&start_cursor=${startCursor}`
  }

  return makeRequestWithRetry<NotionBlocksResponse>(accessToken, endpoint)
}

/**
 * Get all blocks for a page (with pagination and recursive children)
 */
export async function getAllBlocks(
  accessToken: string,
  pageId: string,
  options: {
    maxBlocks?: number
    maxDepth?: number
    currentDepth?: number
  } = {}
): Promise<NotionBlock[]> {
  const { maxBlocks = 1000, maxDepth = 5, currentDepth = 0 } = options

  if (currentDepth >= maxDepth) {
    return []
  }

  const blocks: NotionBlock[] = []
  let cursor: string | undefined

  while (blocks.length < maxBlocks) {
    const response = await getBlocks(accessToken, pageId, {
      startCursor: cursor,
      pageSize: Math.min(100, maxBlocks - blocks.length),
    })

    for (const block of response.results) {
      blocks.push(block)

      // Recursively fetch children if the block has children
      if (block.has_children && blocks.length < maxBlocks) {
        const children = await getAllBlocks(accessToken, block.id, {
          maxBlocks: maxBlocks - blocks.length,
          maxDepth,
          currentDepth: currentDepth + 1,
        })
        blocks.push(...children)
      }

      if (blocks.length >= maxBlocks) {
        break
      }
    }

    if (!response.has_more || !response.next_cursor) {
      break
    }

    cursor = response.next_cursor

    // Rate limit delay
    await sleep(NOTION_RATE_LIMITS.delayBetweenRequests)
  }

  return blocks
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get page title from page object
 */
export function getPageTitle(page: NotionPage): string {
  // Try to find a title property
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === "title" && Array.isArray(prop.title)) {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join("")
    }
  }
  return "Untitled"
}

/**
 * Get database title
 */
export function getDatabaseTitle(database: NotionDatabase): string {
  return database.title.map((t) => t.plain_text).join("") || "Untitled Database"
}

/**
 * Get icon as string (emoji or URL)
 */
export function getIconString(icon: NotionPage["icon"] | NotionDatabase["icon"]): string | null {
  if (!icon) return null

  if (icon.type === "emoji") {
    return icon.emoji
  }

  if (icon.type === "external") {
    return icon.external.url
  }

  if (icon.type === "file") {
    return icon.file.url
  }

  return null
}
