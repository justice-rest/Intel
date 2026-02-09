/**
 * Web Crawl Type Definitions
 */

export interface CrawlConfig {
  maxPages: number
  maxDepth: number
  maxPageSize: number
  fetchTimeout: number
  overallTimeout: number
  domainThrottle: number
  userAgent: string
  signal?: AbortSignal
  /** Pre-resolved IPs from validateUrl(). Used for DNS pinning to prevent rebinding. */
  resolvedIps?: string[]
}

export interface CrawlPage {
  url: string
  title: string
  content: string // Markdown content
  wordCount: number
  depth: number
  statusCode: number
  error?: string
}

export type CrawlProgressType =
  | "crawl_started"
  | "page_fetched"
  | "page_skipped"
  | "page_error"
  | "page_ready"
  | "crawl_complete"
  | "crawl_error"

export interface CrawlProgress {
  type: CrawlProgressType
  url?: string
  title?: string
  pagesProcessed: number
  pagesTotal: number
  pagesSkipped: number
  pagesFailed: number
  error?: string
  documentId?: string
}

export interface CrawlResult {
  pages: CrawlPage[]
  totalPages: number
  skippedPages: number
  failedPages: number
  rootUrl: string
  hostname: string
}
