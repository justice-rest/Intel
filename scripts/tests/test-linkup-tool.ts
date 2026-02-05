#!/usr/bin/env npx tsx
/**
 * Test the actual LinkUp Ultra Research TOOL (not just the API)
 * This tests the complete code path: tool → client → API → response parsing
 */

import { loadEnvFiles } from "./load-env"

// Load environment variables from .env.local or .vercel/.env.production.local
loadEnvFiles()

async function main() {
  console.log("\n🔬 Testing LinkUp Ultra Research Tool (Full Code Path)\n")
  console.log("=".repeat(60))

  // Import the actual tool and client
  const { linkupResearch } = await import("../../lib/linkup/client")

  console.log("\n📡 Calling linkupResearch() - same function the AI tool uses...\n")

  const startTime = Date.now()

  try {
    const result = await linkupResearch({
      query: "Who is the CEO of Anthropic and what is their background?",
      outputType: "sourcedAnswer",
    })

    const durationMs = Date.now() - startTime

    console.log("✅ Success!\n")
    console.log(`⏱️  Duration: ${(durationMs / 1000).toFixed(1)}s`)
    console.log(`📝 Answer length: ${result.answer.length} chars`)
    console.log(`📚 Sources: ${result.sources.length}`)

    console.log("\n--- Answer Preview ---")
    console.log(result.answer.slice(0, 300) + "...")

    console.log("\n--- Sources ---")
    result.sources.slice(0, 5).forEach((s, i) => {
      console.log(`  [${i + 1}] ${s.name}`)
      console.log(`      ${s.url}`)
      if (s.snippet) {
        console.log(`      "${s.snippet.slice(0, 80)}..."`)
      }
    })

    // Verify the structure matches what the AI tool expects
    console.log("\n--- Structure Validation ---")
    const hasAnswer = typeof result.answer === "string" && result.answer.length > 0
    const hasSources = Array.isArray(result.sources)
    const sourcesValid = result.sources.every(s =>
      typeof s.name === "string" &&
      typeof s.url === "string"
    )

    console.log(`  answer (string): ${hasAnswer ? "✅" : "❌"}`)
    console.log(`  sources (array): ${hasSources ? "✅" : "❌"}`)
    console.log(`  sources structure: ${sourcesValid ? "✅" : "❌"}`)

    if (hasAnswer && hasSources && sourcesValid) {
      console.log("\n🎉 Tool response structure is correct!")
      console.log("   The UI will be able to parse and display this.\n")
      process.exit(0)
    } else {
      console.log("\n❌ Response structure issues detected\n")
      process.exit(1)
    }

  } catch (error) {
    console.log("❌ Failed!\n")
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.log(`\nStack:\n${error.stack}`)
    }
    process.exit(1)
  }
}

main()
