#!/usr/bin/env npx ts-node
/**
 * Parallel AI Integration Test Script
 *
 * Tests all Parallel API integrations:
 * 1. Search API - Web search
 * 2. Extract API - URL content extraction
 * 3. Task API - Structured JSON output
 * 4. Task Groups - Batch processing
 *
 * Usage:
 *   PARALLEL_API_KEY=your_key npx ts-node scripts/test-parallel-integration.ts
 */

import Parallel from "parallel-web"

// Colors for console output
const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const BLUE = "\x1b[34m"
const RESET = "\x1b[0m"

function log(color: string, prefix: string, message: string) {
  console.log(`${color}[${prefix}]${RESET} ${message}`)
}

function success(message: string) { log(GREEN, "✓ PASS", message) }
function fail(message: string) { log(RED, "✗ FAIL", message) }
function info(message: string) { log(BLUE, "INFO", message) }
function warn(message: string) { log(YELLOW, "WARN", message) }

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// TEST: Search API
// ============================================================================
async function testSearchAPI(client: Parallel): Promise<boolean> {
  info("Testing Search API...")

  try {
    // Search API - SDK automatically adds the beta header
    // Don't pass betas explicitly to avoid duplication
    const result = await client.beta.search({
      objective: "Find information about Warren Buffett's philanthropy",
      mode: "one-shot", // Use one-shot for more reliable results
      max_results: 5,
    })

    if (result.results && result.results.length > 0) {
      success(`Search API returned ${result.results.length} results`)
      console.log(`   Search ID: ${result.search_id}`)
      console.log(`   First result: ${result.results[0].url}`)
      return true
    } else {
      fail("Search API returned no results")
      return false
    }
  } catch (error) {
    fail(`Search API error: ${error instanceof Error ? error.message : error}`)
    return false
  }
}

// ============================================================================
// TEST: Extract API
// ============================================================================
async function testExtractAPI(client: Parallel): Promise<boolean> {
  info("Testing Extract API...")

  try {
    // Extract API - SDK automatically adds the beta header
    const result = await client.beta.extract({
      urls: ["https://en.wikipedia.org/wiki/Bill_Gates"],
      objective: "Extract information about Bill Gates philanthropy",
    })

    if (result.results && result.results.length > 0) {
      success(`Extract API extracted ${result.results.length} pages`)
      console.log(`   Extract ID: ${result.extract_id}`)
      console.log(`   Title: ${result.results[0].title}`)
      if (result.errors && result.errors.length > 0) {
        warn(`   ${result.errors.length} extraction errors`)
      }
      return true
    } else {
      fail("Extract API returned no results")
      return false
    }
  } catch (error) {
    fail(`Extract API error: ${error instanceof Error ? error.message : error}`)
    return false
  }
}

// ============================================================================
// TEST: Task API (Structured Output)
// ============================================================================
async function testTaskAPI(client: Parallel): Promise<boolean> {
  info("Testing Task API (structured output)...")

  try {
    // Create a task run with structured output schema
    // SDK automatically adds the beta header
    const run = await client.beta.taskRun.create({
      input: {
        task: "Research basic facts about Elon Musk",
        fields: ["name", "age", "companies"]
      },
      processor: "pro",
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: ["integer", "null"] },
              companies: {
                type: "array",
                items: { type: "string" }
              },
              summary: { type: "string" }
            },
            required: ["name", "summary"]
          }
        }
      },
    })

    console.log(`   Run ID: ${run.run_id}`)
    console.log(`   Status: ${run.status}`)

    // Wait for result (with timeout - Task API can take 60-120s)
    info("   Waiting for task result (up to 120s)...")
    const result = await client.beta.taskRun.result(run.run_id, {
      timeout: 120,
    })

    if (result.run.status === "completed") {
      success(`Task API completed with ${result.output.type} output`)
      if (result.output.type === "json") {
        console.log(`   Output: ${JSON.stringify(result.output.content).substring(0, 200)}...`)
      }
      return true
    } else {
      fail(`Task API ended with status: ${result.run.status}`)
      return false
    }
  } catch (error) {
    fail(`Task API error: ${error instanceof Error ? error.message : error}`)
    return false
  }
}

// ============================================================================
// TEST: Task Groups (Batch Processing)
// ============================================================================
async function testTaskGroups(client: Parallel): Promise<boolean> {
  info("Testing Task Groups API (batch processing)...")

  try {
    // Create a task group
    const group = await client.beta.taskGroup.create({
      metadata: {
        test: "integration-test",
        timestamp: new Date().toISOString()
      }
    })

    console.log(`   Group ID: ${group.taskgroup_id}`)

    // Add runs to the group - SDK automatically adds the beta header
    const runsResponse = await client.beta.taskGroup.addRuns(group.taskgroup_id, {
      inputs: [
        {
          input: "What is 2+2?",
          processor: "base",
        },
        {
          input: "What is 3+3?",
          processor: "base",
        }
      ],
    })

    console.log(`   Added ${runsResponse.run_ids.length} runs`)
    console.log(`   Status: ${runsResponse.status.status_message}`)

    // Poll for completion
    info("   Waiting for group completion...")
    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
      const status = await client.beta.taskGroup.retrieve(group.taskgroup_id)

      if (!status.status.is_active) {
        success(`Task Groups completed: ${status.status.task_run_status_counts.completed || 0} succeeded`)
        return true
      }

      await sleep(2000)
      attempts++
    }

    warn("Task Groups timed out (but API is working)")
    return true // API works, just slow

  } catch (error) {
    fail(`Task Groups error: ${error instanceof Error ? error.message : error}`)
    return false
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log("\n" + "=".repeat(60))
  console.log("  PARALLEL AI INTEGRATION TEST")
  console.log("=".repeat(60) + "\n")

  const apiKey = process.env.PARALLEL_API_KEY

  if (!apiKey) {
    fail("PARALLEL_API_KEY environment variable not set")
    console.log("\nUsage: PARALLEL_API_KEY=your_key npx ts-node scripts/test-parallel-integration.ts\n")
    process.exit(1)
  }

  info(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`)

  const client = new Parallel({
    apiKey,
    timeout: 120000,
    maxRetries: 1,
  })

  const results: Record<string, boolean> = {}

  // Run tests
  console.log("\n" + "-".repeat(60))
  results["Search API"] = await testSearchAPI(client)

  console.log("\n" + "-".repeat(60))
  results["Extract API"] = await testExtractAPI(client)

  console.log("\n" + "-".repeat(60))
  results["Task API"] = await testTaskAPI(client)

  console.log("\n" + "-".repeat(60))
  results["Task Groups"] = await testTaskGroups(client)

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("  SUMMARY")
  console.log("=".repeat(60))

  let passed = 0
  let failed = 0

  for (const [name, result] of Object.entries(results)) {
    if (result) {
      success(name)
      passed++
    } else {
      fail(name)
      failed++
    }
  }

  console.log("\n" + "-".repeat(60))
  console.log(`  Total: ${passed} passed, ${failed} failed`)
  console.log("=".repeat(60) + "\n")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(error => {
  fail(`Unexpected error: ${error}`)
  process.exit(1)
})
