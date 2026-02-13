/**
 * Web Crawl Configuration
 * Constants and limits for the URL import crawler
 */

// Page limits
export const CRAWL_MAX_PAGES = 25
export const CRAWL_MAX_DEPTH = 3

// Size limits
export const CRAWL_MAX_PAGE_SIZE = 1 * 1024 * 1024 // 1MB per page
export const CRAWL_MIN_CONTENT_LENGTH = 100 // chars - skip low-value pages

// Timeouts
export const CRAWL_FETCH_TIMEOUT = 15_000 // 15s per page (increased from 10s — CDN/WAF challenge pages need more time)
export const CRAWL_OVERALL_TIMEOUT = 180_000 // 3 minutes total

// Throttling
export const CRAWL_DOMAIN_THROTTLE = 1_000 // 1s between requests to same domain

// User-Agent for page fetching — browser-like to avoid WAF/CDN blocks.
// Sites like Cloudflare serve empty or challenge pages to bot UAs,
// causing content extraction to fail with "Too little content".
// We still identify as RomyBot in robots.txt checks (see CRAWL_ROBOTS_USER_AGENT).
export const CRAWL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

// User-Agent for robots.txt identification — identifies us as a bot
// so site owners can specifically allow/block our crawler.
export const CRAWL_ROBOTS_USER_AGENT = "RomyBot/1.0 (+https://getromy.app)"

// SSRF Prevention - Private/reserved IP ranges
// Covers: RFC 1918, RFC 6598, loopback, link-local, cloud metadata, benchmarking, reserved
export const SSRF_BLOCKED_IP_RANGES = [
  // IPv4 private ranges (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Current network (RFC 1122)
  /^0\./,
  // Loopback (RFC 1122)
  /^127\./,
  // Link-local (RFC 3927)
  /^169\.254\./,
  // Carrier-grade NAT / Shared Address Space (RFC 6598) — used in AWS VPCs
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
  // Benchmarking (RFC 2544)
  /^198\.1[89]\./,
  // Reserved for future use (RFC 1112)
  /^240\./,
  // Cloud metadata
  /^169\.254\.169\.254$/,
  // IPv4 mapped IPv6
  /^::ffff:10\./,
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^::ffff:192\.168\./,
  /^::ffff:127\./,
  // IPv6 loopback
  /^::1$/,
  // IPv6 link-local
  /^fe80:/i,
  // IPv6 private (Unique Local Addresses, RFC 4193)
  /^fc00:/i,
  /^fd00:/i,
]

// SSRF Prevention - Blocked hostnames
export const SSRF_BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "169.254.169.254",
  "metadata",
  "[::1]",
  "0.0.0.0",
]

// Allowed protocols
export const CRAWL_ALLOWED_PROTOCOLS = ["https:", "http:"]

// Content types to process
export const CRAWL_ALLOWED_CONTENT_TYPES = ["text/html"]
