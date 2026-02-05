#!/usr/bin/env npx tsx
/**
 * Test the actual AI Tool definition (linkupUltraResearchTool)
 * This is what gets called when the AI invokes the tool
 */

import { loadEnvFiles } from "./load-env"

// Load environment variables from .env.local or .vercel/.env.production.local
loadEnvFiles()

type UltraResearchResult = {
  content: string
  sources: Array<{ name: string; url: string; snippet?: string }>
  searchQueries?: string[]
  durationMs?: number
  mode: string
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

async function main() {
  console.log("\n🤖 Testing LinkUp Ultra Research AI Tool\n")
  console.log("=".repeat(60))

  // Import the actual AI tool
  const { linkupUltraResearchTool } = await import("../../lib/tools/linkup-ultra-research")

  console.log("\n📡 Calling linkupUltraResearchTool.execute() - exactly what the AI does...\n")

  const startTime = Date.now()

  try {
    // Call the tool's execute function directly (same as AI SDK does)
    const execute = linkupUltraResearchTool.execute
    if (typeof execute !== "function") {
      throw new Error("linkupUltraResearchTool.execute is not available.")
    }

    const rawResult = await execute(
      {
        query: "What companies has Marc Benioff founded or invested in?",
        outputType: "sourcedAnswer",
      },
      { toolCallId: "test-call-123", messages: [], abortSignal: undefined as any }
    )

    const durationMs = Date.now() - startTime
    const result = (await resolveToolResult(rawResult)) as UltraResearchResult

    console.log("✅ Tool executed successfully!\n")
    console.log("--- Raw Tool Result ---")
    console.log(JSON.stringify(result, null, 2).slice(0, 1500))

    // Verify the structure that the UI expects
    console.log("\n--- UI Compatibility Check ---")

    const hasContent = typeof result.content === "string"
    const hasSources = Array.isArray(result.sources)
    const hasMode = result.mode === "ultra-research"
    const hasProvider = result.provider === "linkup-research"
    const hasBeta = result.isBeta === true

    console.log(`  content (string): ${hasContent ? "✅" : "❌"} (${result.content?.length || 0} chars)`)
    console.log(`  sources (array): ${hasSources ? "✅" : "❌"} (${result.sources?.length || 0} items)`)
    console.log(`  mode: ${hasMode ? "✅" : "❌"} (${result.mode})`)
    console.log(`  provider: ${hasProvider ? "✅" : "❌"} (${result.provider})`)
    console.log(`  isBeta: ${hasBeta ? "✅" : "❌"} (${result.isBeta})`)
    console.log(`  durationMs: ${result.durationMs ? "✅" : "❌"} (${result.durationMs}ms)`)

    // Check for error
    if (result.error) {
      console.log(`\n❌ Tool returned error: ${result.error}`)
      process.exit(1)
    }

    if (hasContent && hasSources && hasMode && hasProvider && hasBeta) {
      console.log("\n🎉 AI Tool returns correct structure for UI!")
      console.log("   tool-invocation.tsx will render this correctly.\n")
      process.exit(0)
    } else {
      console.log("\n❌ Structure issues - UI may not render correctly\n")
      process.exit(1)
    }

  } catch (error) {
    console.log("❌ Tool execution failed!\n")
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
