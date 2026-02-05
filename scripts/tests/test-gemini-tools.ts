#!/usr/bin/env npx tsx
/**
 * Test Gemini Search Tools (Flash and Pro/Ultra)
 *
 * Usage:
 *   npx tsx scripts/tests/test-gemini-tools.ts
 *   npx tsx scripts/tests/test-gemini-tools.ts --flash-only
 *   npx tsx scripts/tests/test-gemini-tools.ts --pro-only
 */

import { readFileSync } from "fs"
import { resolve } from "path"

// Load environment variables
function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        let value = trimmed.slice(eqIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  } catch {
    // Ignore
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"))

type GeminiSearchResult = {
  content: string
  sources: Array<{ name: string; url: string }>
  searchQueries?: string[]
  durationMs?: number
  model?: string
  mode?: string
  provider: string
  isBeta: boolean
  error?: string
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    !!value &&
    typeof value === "object" &&
    Symbol.asyncIterator in value &&
    typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === "function"
  )
}

async function resolveToolResult<T>(value: T | AsyncIterable<T>): Promise<T> {
  if (!isAsyncIterable<T>(value)) return value

  let last: T | undefined
  for await (const chunk of value) {
    last = chunk
  }

  if (last === undefined) {
    throw new Error("Tool returned an empty stream.")
  }

  return last
}

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log()
  log(`${"=".repeat(60)}`, "cyan")
  log(`  ${title}`, "bright")
  log(`${"=".repeat(60)}`, "cyan")
  console.log()
}

async function testGeminiFlash(): Promise<boolean> {
  logSection("Testing Gemini Search (Flash - gemini-3-flash-preview)")

  const { geminiGroundedSearchTool } = await import("../../lib/tools/gemini-grounded-search")

  const query = "What are the key features of Claude 3.5 Sonnet?"

  log(`  Query: "${query}"`, "blue")
  log("  Executing...", "blue")

  const startTime = Date.now()

  try {
    const execute = geminiGroundedSearchTool.execute
    if (typeof execute !== "function") {
      throw new Error("geminiGroundedSearchTool.execute is not available.")
    }

    const rawResult = await execute(
      { query },
      { toolCallId: "test-flash", messages: [], abortSignal: undefined as any }
    )

    const durationMs = Date.now() - startTime
    const result = (await resolveToolResult(rawResult)) as GeminiSearchResult

    if (result.error) {
      log(`  ❌ Error: ${result.error}`, "red")
      return false
    }

    log(`  ✅ Success in ${(durationMs / 1000).toFixed(1)}s`, "green")
    log(`  📝 Content: ${result.content?.length || 0} chars`, "blue")
    log(`  📚 Sources: ${result.sources?.length || 0}`, "blue")
    log(`  🔍 Queries: ${result.searchQueries?.length || 0}`, "blue")
    log(`  🤖 Model: ${result.model || "unknown"}`, "blue")

    if (result.content) {
      log(`\n  Preview: "${result.content.slice(0, 150)}..."`, "cyan")
    }

    return true
  } catch (error) {
    log(`  ❌ Exception: ${error instanceof Error ? error.message : String(error)}`, "red")
    return false
  }
}

async function testGeminiPro(): Promise<boolean> {
  logSection("Testing Gemini Ultra Search (Pro - gemini-3-pro-preview)")

  const { geminiUltraSearchTool } = await import("../../lib/tools/gemini-grounded-search")

  const query = "Comprehensive background on Marc Benioff: career, philanthropy, investments"
  const context = "Looking for information about the Salesforce CEO for prospect research"

  log(`  Query: "${query}"`, "blue")
  log(`  Context: "${context}"`, "blue")
  log("  Executing (this may take longer)...", "blue")

  const startTime = Date.now()

  try {
    const execute = geminiUltraSearchTool.execute
    if (typeof execute !== "function") {
      throw new Error("geminiUltraSearchTool.execute is not available.")
    }

    const rawResult = await execute(
      { query, context },
      { toolCallId: "test-pro", messages: [], abortSignal: undefined as any }
    )

    const durationMs = Date.now() - startTime
    const result = (await resolveToolResult(rawResult)) as GeminiSearchResult

    if (result.error) {
      log(`  ❌ Error: ${result.error}`, "red")
      return false
    }

    log(`  ✅ Success in ${(durationMs / 1000).toFixed(1)}s`, "green")
    log(`  📝 Content: ${result.content?.length || 0} chars`, "blue")
    log(`  📚 Sources: ${result.sources?.length || 0}`, "blue")
    log(`  🔍 Queries: ${result.searchQueries?.length || 0}`, "blue")
    log(`  🤖 Model: ${result.model || "unknown"}`, "blue")
    log(`  🎯 Mode: ${result.mode || "unknown"}`, "blue")

    if (result.content) {
      log(`\n  Preview: "${result.content.slice(0, 200)}..."`, "cyan")
    }

    // Verify structure for UI
    const hasContent = typeof result.content === "string" && result.content.length > 0
    const hasSources = Array.isArray(result.sources)
    const hasMode = result.mode === "ultra-search"

    log(`\n  --- UI Compatibility ---`, "yellow")
    log(`  content: ${hasContent ? "✅" : "❌"}`, hasContent ? "green" : "red")
    log(`  sources: ${hasSources ? "✅" : "❌"}`, hasSources ? "green" : "red")
    log(`  mode=ultra-search: ${hasMode ? "✅" : "❌"}`, hasMode ? "green" : "red")

    return hasContent && hasSources && hasMode
  } catch (error) {
    log(`  ❌ Exception: ${error instanceof Error ? error.message : String(error)}`, "red")
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const flashOnly = args.includes("--flash-only")
  const proOnly = args.includes("--pro-only")

  log("\n🔬 Gemini Search Tools Test Suite", "bright")
  log("==================================\n", "cyan")

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    log("❌ GOOGLE_AI_API_KEY not set in environment", "red")
    process.exit(1)
  }

  log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`, "blue")

  const results: { name: string; passed: boolean }[] = []

  if (!proOnly) {
    const flashPassed = await testGeminiFlash()
    results.push({ name: "Gemini Flash (gemini-3-flash-preview)", passed: flashPassed })
  }

  if (!flashOnly) {
    const proPassed = await testGeminiPro()
    results.push({ name: "Gemini Pro (gemini-3-pro-preview)", passed: proPassed })
  }

  logSection("Test Summary")

  let allPassed = true
  for (const result of results) {
    if (result.passed) {
      log(`  ✅ ${result.name}: PASSED`, "green")
    } else {
      log(`  ❌ ${result.name}: FAILED`, "red")
      allPassed = false
    }
  }

  console.log()
  if (allPassed) {
    log("🎉 All tests passed!", "green")
  } else {
    log("💥 Some tests failed!", "red")
  }

  process.exit(allPassed ? 0 : 1)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
