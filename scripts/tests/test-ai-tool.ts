#!/usr/bin/env npx tsx
/**
 * Test the actual AI Tool definition (linkupUltraResearchTool)
 * This is what gets called when the AI invokes the tool
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

async function main() {
  console.log("\n🤖 Testing LinkUp Ultra Research AI Tool\n")
  console.log("=".repeat(60))

  // Import the actual AI tool
  const { linkupUltraResearchTool } = await import("../../lib/tools/linkup-ultra-research")

  console.log("\n📡 Calling linkupUltraResearchTool.execute() - exactly what the AI does...\n")

  const startTime = Date.now()

  try {
    // Call the tool's execute function directly (same as AI SDK does)
    const result = await linkupUltraResearchTool.execute(
      {
        query: "What companies has Marc Benioff founded or invested in?",
        outputType: "sourcedAnswer",
      },
      { toolCallId: "test-call-123", messages: [], abortSignal: undefined as any }
    )

    const durationMs = Date.now() - startTime

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
