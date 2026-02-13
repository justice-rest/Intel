/**
 * URL Validation and SSRF Prevention
 * Defense-in-depth against Server-Side Request Forgery
 *
 * Key protections:
 * - DNS resolution with private IP check
 * - IP pinning to prevent DNS rebinding (TOCTOU)
 * - Post-redirect validation
 * - Protocol, hostname, and IP range blocklists
 * - robots.txt respect with redirect-safe fetching
 */

import { resolve } from "dns/promises"
import {
  CRAWL_ALLOWED_PROTOCOLS,
  SSRF_BLOCKED_HOSTNAMES,
  SSRF_BLOCKED_IP_RANGES,
  CRAWL_ROBOTS_USER_AGENT,
  CRAWL_FETCH_TIMEOUT,
} from "./config"

/**
 * Resolved IP addresses for a validated hostname.
 * Used by the crawler to pin connections to validated IPs (DNS rebinding prevention).
 */
export interface ValidatedUrl {
  url: URL
  resolvedIps: string[]
}

/**
 * Validate and sanitize a URL for crawling
 * Checks protocol, hostname, and DNS resolution for private IPs.
 * Returns the resolved IPs so the caller can pin DNS (prevents rebinding).
 */
export async function validateUrl(rawUrl: string): Promise<{
  valid: boolean
  url?: URL
  resolvedIps?: string[]
  error?: string
}> {
  // Basic URL parsing
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }

  // Protocol check
  if (!CRAWL_ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return {
      valid: false,
      error: `Protocol "${url.protocol}" is not allowed. Only HTTPS and HTTP are supported.`,
    }
  }

  // Hostname blocklist check
  const hostname = url.hostname.toLowerCase()
  if (SSRF_BLOCKED_HOSTNAMES.includes(hostname)) {
    return {
      valid: false,
      error: "This hostname is not allowed for security reasons.",
    }
  }

  // Resolve DNS and check for private IPs
  // Store resolved IPs for DNS pinning (prevents rebinding)
  // Try A records first, fall back to AAAA for IPv6-only hosts
  let addresses: string[] = []
  try {
    addresses = await resolve(hostname)
  } catch {
    // No A records — try AAAA
  }
  if (addresses.length === 0) {
    try {
      addresses = await resolve(hostname, "AAAA")
    } catch {
      // No AAAA records either
    }
  }

  if (addresses.length === 0) {
    return {
      valid: false,
      error: "Could not resolve hostname. Please check the URL.",
    }
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      return {
        valid: false,
        error: "This URL cannot be accessed for security reasons.",
      }
    }
  }

  return { valid: true, url, resolvedIps: addresses }
}

/**
 * Validate the final URL after redirects
 * Catches SSRF via redirect to private IP
 */
export async function validateRedirectedUrl(finalUrl: string): Promise<{
  valid: boolean
  error?: string
}> {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return { valid: false, error: "Invalid redirect URL" }
  }

  if (!CRAWL_ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return { valid: false, error: "Redirect to disallowed protocol" }
  }

  const hostname = url.hostname.toLowerCase()
  if (SSRF_BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: "Redirect to blocked hostname" }
  }

  try {
    const addresses = await resolve(hostname)
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { valid: false, error: "Redirect resolves to private IP" }
      }
    }
  } catch {
    return { valid: false, error: "Cannot resolve redirect target" }
  }

  return { valid: true }
}

/**
 * Check if an IP address is in a private/reserved range
 * Covers: RFC 1918, loopback, link-local, cloud metadata, carrier-grade NAT,
 * current network, benchmarking, reserved ranges
 */
function isPrivateIp(ip: string): boolean {
  for (const pattern of SSRF_BLOCKED_IP_RANGES) {
    if (pattern.test(ip)) {
      return true
    }
  }
  return false
}

/**
 * Check if a URL is same-origin as the root URL
 */
export function isSameOrigin(url: URL, rootUrl: URL): boolean {
  return url.hostname === rootUrl.hostname
}

/**
 * Normalize a URL for deduplication
 * Strips fragments, sorts query params, normalizes trailing slashes
 */
export function normalizeUrl(urlString: string, baseUrl?: string): string | null {
  try {
    const url = baseUrl ? new URL(urlString, baseUrl) : new URL(urlString)
    // Strip fragment
    url.hash = ""
    // Sort query params for consistent comparison
    url.searchParams.sort()
    // Normalize path: remove trailing slash unless it's the root
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.href
  } catch {
    return null
  }
}

/**
 * Fetch and parse robots.txt for a domain
 * Returns whether the given path is allowed for our crawler.
 * Uses redirect: "manual" to prevent SSRF via robots.txt redirect.
 */
export async function checkRobotsTxt(
  rootUrl: URL,
  path: string
): Promise<{ allowed: boolean; error?: string }> {
  const robotsUrl = `${rootUrl.protocol}//${rootUrl.hostname}/robots.txt`

  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": CRAWL_ROBOTS_USER_AGENT },
      signal: AbortSignal.timeout(CRAWL_FETCH_TIMEOUT),
      redirect: "manual", // Prevent SSRF via redirect to internal resources
    })

    // 404 = no restrictions (standard convention)
    if (response.status === 404) {
      return { allowed: true }
    }

    // Redirect = treat as no robots.txt (we don't follow redirects for safety)
    if (response.status >= 300 && response.status < 400) {
      return { allowed: true }
    }

    if (!response.ok) {
      // Non-404 errors: allow crawling (fail-open for non-404)
      return { allowed: true }
    }

    const text = await response.text()
    return { allowed: isPathAllowed(text, path) }
  } catch {
    // Network error fetching robots.txt: allow crawling
    return { allowed: true }
  }
}

/**
 * Robots.txt parser with proper block scoping
 * Checks User-agent: * and User-agent: RomyBot directives
 *
 * Per RFC 9309: most specific User-agent match wins.
 * We check for "romybot" (specific) and "*" (wildcard).
 * If "romybot" block exists, use it. Otherwise, use "*" block.
 */
function isPathAllowed(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split("\n").map((l) => l.trim())

  // Parse into blocks: each block = { agents: string[], rules: { type, path }[] }
  interface RobotsRule {
    type: "allow" | "disallow"
    path: string
  }
  interface RobotsBlock {
    agents: string[]
    rules: RobotsRule[]
  }

  const blocks: RobotsBlock[] = []
  let currentBlock: RobotsBlock | null = null

  for (const line of lines) {
    if (line.startsWith("#") || line === "") continue

    const lower = line.toLowerCase()

    if (lower.startsWith("user-agent:")) {
      const agent = lower.slice("user-agent:".length).trim()
      // If previous line was also user-agent, extend the current block
      if (currentBlock && currentBlock.rules.length === 0) {
        currentBlock.agents.push(agent)
      } else {
        // Start new block
        currentBlock = { agents: [agent], rules: [] }
        blocks.push(currentBlock)
      }
      continue
    }

    if (!currentBlock) continue

    if (lower.startsWith("disallow:")) {
      const disallowPath = line.slice("disallow:".length).trim()
      if (disallowPath === "") continue // Empty Disallow = allow everything
      currentBlock.rules.push({ type: "disallow", path: disallowPath })
    } else if (lower.startsWith("allow:")) {
      const allowPath = line.slice("allow:".length).trim()
      if (allowPath === "") continue
      currentBlock.rules.push({ type: "allow", path: allowPath })
    }
  }

  // Find the most specific matching block
  // Priority: "romybot" > "*"
  let matchingBlock: RobotsBlock | null = null
  for (const block of blocks) {
    if (block.agents.includes("romybot")) {
      matchingBlock = block
      break // Most specific match
    }
    if (block.agents.includes("*") && !matchingBlock) {
      matchingBlock = block
    }
  }

  if (!matchingBlock) return true // No matching block = allowed

  // Check rules: most specific path match wins (longest prefix)
  let bestMatch: RobotsRule | null = null
  let bestMatchLength = -1

  for (const rule of matchingBlock.rules) {
    if (path.startsWith(rule.path) && rule.path.length > bestMatchLength) {
      bestMatch = rule
      bestMatchLength = rule.path.length
    }
  }

  if (!bestMatch) return true // No matching rule = allowed
  return bestMatch.type === "allow"
}
