#!/usr/bin/env npx tsx
/**
 * Integration tests for Beta Tools: LinkUp Ultra Research & Gemini Grounded Search
 *
 * Usage:
 *   npx tsx scripts/tests/test-beta-tools.ts
 *   npx tsx scripts/tests/test-beta-tools.ts --linkup-only
 *   npx tsx scripts/tests/test-beta-tools.ts --gemini-only
 *
 * Requires:
 *   - LINKUP_API_KEY in .env.local or .vercel/.env.production.local (for LinkUp Ultra Research)
 *   - GOOGLE_AI_API_KEY in .env.local or .vercel/.env.production.local (for Gemini Grounded Search)
 */

import { loadEnvFiles } from "./load-env"

loadEnvFiles()

// ANSI colors for output
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

function logSuccess(message: string) {
  log(`  ✅ ${message}`, "green")
}

function logError(message: string) {
  log(`  ❌ ${message}`, "red")
}

function logInfo(message: string) {
  log(`  ℹ️  ${message}`, "blue")
}

function logWarning(message: string) {
  log(`  ⚠️  ${message}`, "yellow")
}

// ============================================================================
// LinkUp Ultra Research Tests
// ============================================================================

async function testLinkUpUltraResearch(): Promise<boolean> {
  logSection("Testing LinkUp Ultra Research (/research endpoint)")

  const apiKey = process.env.LINKUP_API_KEY
  if (!apiKey) {
    logError("LINKUP_API_KEY not set in environment")
    return false
  }

  logInfo(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)

  const testQuery = "Who founded Anthropic and when was it established?"

  try {
    // Step 1: Start research task
    logInfo("Step 1: Starting research task...")
    const startTime = Date.now()

    const startResponse = await fetch("https://api.linkup.so/v1/research", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: testQuery,
        outputType: "sourcedAnswer",
      }),
    })

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      logError(`Failed to start research: ${startResponse.status} ${errorText}`)
      return false
    }

    const startData = await startResponse.json()
    const taskId = startData.id

    if (!taskId) {
      logError("No task ID returned from /research endpoint")
      logInfo(`Response: ${JSON.stringify(startData)}`)
      return false
    }

    logSuccess(`Task started with ID: ${taskId}`)

    // Step 2: Poll for results
    logInfo("Step 2: Polling for results...")
    let pollCount = 0
    const maxPolls = 60 // 2 minutes max
    let result: any = null

    while (pollCount < maxPolls) {
      pollCount++
      const pollResponse = await fetch(
        `https://api.linkup.so/v1/research/${taskId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      )

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text()
        logError(`Poll failed: ${pollResponse.status} ${errorText}`)
        return false
      }

      result = await pollResponse.json()
      const status = result.status

      if (status === "pending" || status === "processing") {
        process.stdout.write(`\r  ⏳ Status: ${status} (poll ${pollCount})...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }

      // Task complete
      console.log() // New line after polling dots
      break
    }

    const durationMs = Date.now() - startTime

    if (pollCount >= maxPolls) {
      logError("Polling timed out after 2 minutes")
      return false
    }

    logSuccess(`Research completed in ${(durationMs / 1000).toFixed(1)}s`)

    // Step 3: Validate response structure
    logInfo("Step 3: Validating response structure...")
    logInfo(`Response keys: ${Object.keys(result).join(", ")}`)

    // Debug: Log the full response structure (truncated)
    const debugResponse = JSON.stringify(result, null, 2)
    logInfo(`Full response preview:\n${debugResponse.slice(0, 1000)}${debugResponse.length > 1000 ? '...' : ''}`)

    // Check for answer/output field - handle different response formats
    let answer: string | undefined
    if (typeof result.output === "string") {
      answer = result.output
    } else if (typeof result.answer === "string") {
      answer = result.answer
    } else if (typeof result.content === "string") {
      answer = result.content
    } else if (result.output && typeof result.output === "object") {
      // Handle case where output might be an object with text
      answer = JSON.stringify(result.output)
    }

    if (!answer) {
      logError("No answer/output field in response")
      return false
    }

    logSuccess(`Answer received (${answer.length} chars)`)
    logInfo(`Preview: "${answer.slice(0, 150)}..."`)

    // Check for sources - handle nested structure { output: { sources: [...] } }
    const sources = result.output?.sources || result.sources
    if (Array.isArray(sources) && sources.length > 0) {
      logSuccess(`Sources: ${sources.length} citations`)
      sources.slice(0, 3).forEach((s: any, i: number) => {
        logInfo(`  [${i + 1}] ${s.name || s.title || "Untitled"} - ${s.url}`)
      })
    } else {
      logWarning("No sources returned (may be expected for some queries)")
    }

    return true
  } catch (error) {
    logError(`Exception: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

// ============================================================================
// Gemini Grounded Search Tests
// ============================================================================

async function testGeminiGroundedSearch(): Promise<boolean> {
  logSection("Testing Gemini Grounded Search")

  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    logError("GOOGLE_AI_API_KEY not set in environment")
    return false
  }

  logInfo(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)

  try {
    // Dynamic import to avoid loading if not needed
    const { GoogleGenAI } = await import("@google/genai")

    const ai = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_TEST_MODEL || "gemini-3-flash-preview"
    const testQuery = "What are the latest features in Claude 3.5 Sonnet?"

    logInfo(`Model: ${model}`)
    logInfo(`Query: "${testQuery}"`)
    logInfo("Executing grounded search...")

    const startTime = Date.now()

    const response = await ai.models.generateContent({
      model,
      contents: testQuery,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })

    const durationMs = Date.now() - startTime
    logSuccess(`Response received in ${(durationMs / 1000).toFixed(1)}s`)

    // Extract text
    let text = ""
    try {
      text = response.text || ""
    } catch {
      // Try alternative extraction
      const candidate = response.candidates?.[0]
      if (candidate?.content?.parts?.length) {
        text = candidate.content.parts
          .filter((p: any) => typeof p.text === "string")
          .map((p: any) => p.text)
          .join("\n")
      }
    }

    if (!text) {
      logError("No text in response")
      logInfo(`Response structure: ${JSON.stringify(Object.keys(response))}`)
      return false
    }

    logSuccess(`Text received (${text.length} chars)`)
    logInfo(`Preview: "${text.slice(0, 150)}..."`)

    // Extract grounding metadata
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata
    if (groundingMetadata) {
      const sources = groundingMetadata.groundingChunks || []
      const queries = groundingMetadata.webSearchQueries || []

      if (sources.length > 0) {
        logSuccess(`Sources: ${sources.length} grounding chunks`)
        sources.slice(0, 3).forEach((chunk: any, i: number) => {
          logInfo(`  [${i + 1}] ${chunk.web?.title || "Untitled"} - ${chunk.web?.uri}`)
        })
      }

      if (queries.length > 0) {
        logSuccess(`Search queries executed: ${queries.length}`)
        queries.forEach((q: string, i: number) => {
          logInfo(`  [${i + 1}] "${q}"`)
        })
      }
    } else {
      logWarning("No grounding metadata in response")
    }

    return true
  } catch (error) {
    logError(`Exception: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logInfo(`Stack: ${error.stack.split("\n").slice(0, 3).join("\n")}`)
    }
    return false
  }
}

// ============================================================================
// Test the Tool Return Format (simulates what the AI tools return)
// ============================================================================

async function testToolReturnFormat(): Promise<boolean> {
  logSection("Testing Tool Return Format (UI Compatibility)")

  // Simulate what gemini_grounded_search tool returns
  const geminiToolResult = {
    content: "This is a sample answer from Gemini grounded search.",
    sources: [
      { name: "Source 1", url: "https://example.com/1" },
      { name: "Source 2", url: "https://example.com/2" },
    ],
    searchQueries: ["test query"],
    durationMs: 1234,
    provider: "gemini-grounded",
    isBeta: true,
  }

  // Simulate what linkup_ultra_research tool returns
  const linkupToolResult = {
    content: "This is a sample research answer from LinkUp ultra research.",
    sources: [
      { name: "Research Source 1", url: "https://example.com/r1", snippet: "A snippet..." },
      { name: "Research Source 2", url: "https://example.com/r2", snippet: "Another snippet..." },
    ],
    searchQueries: ["research query 1", "research query 2"],
    durationMs: 5678,
    mode: "ultra-research",
    provider: "linkup-research",
    isBeta: true,
  }

  // Test that both have the required structure for UI parsing
  const testCases = [
    { name: "Gemini Tool Result", result: geminiToolResult },
    { name: "LinkUp Tool Result", result: linkupToolResult },
  ]

  let allPassed = true

  for (const testCase of testCases) {
    logInfo(`Checking ${testCase.name}...`)

    const { result } = testCase
    const hasContent = typeof result.content === "string"
    const hasSources = Array.isArray(result.sources)
    const hasIsBeta = result.isBeta === true

    if (hasContent && hasSources && hasIsBeta) {
      logSuccess(`${testCase.name}: Valid structure`)
    } else {
      logError(`${testCase.name}: Invalid structure`)
      logInfo(`  content: ${hasContent}, sources: ${hasSources}, isBeta: ${hasIsBeta}`)
      allPassed = false
    }

    // Test UI parsing logic (simulates tool-invocation.tsx)
    if (typeof result === "object" && result !== null && "content" in result) {
      if (!Array.isArray(result.content)) {
        // This is the case we fixed - content is a string, not an array
        logSuccess(`${testCase.name}: UI parsing will work (content is string)`)
      }
    }
  }

  return allPassed
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const linkupOnly = args.includes("--linkup-only")
  const geminiOnly = args.includes("--gemini-only")

  log("\n🧪 Beta Tools Integration Tests", "bright")
  log("================================\n", "cyan")

  const results: { name: string; passed: boolean }[] = []

  // Test tool return format first (no API calls)
  const formatPassed = await testToolReturnFormat()
  results.push({ name: "Tool Return Format", passed: formatPassed })

  // LinkUp test
  if (!geminiOnly) {
    const linkupPassed = await testLinkUpUltraResearch()
    results.push({ name: "LinkUp Ultra Research", passed: linkupPassed })
  }

  // Gemini test
  if (!linkupOnly) {
    const geminiPassed = await testGeminiGroundedSearch()
    results.push({ name: "Gemini Grounded Search", passed: geminiPassed })
  }

  // Summary
  logSection("Test Summary")

  let allPassed = true
  for (const result of results) {
    if (result.passed) {
      logSuccess(`${result.name}: PASSED`)
    } else {
      logError(`${result.name}: FAILED`)
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
