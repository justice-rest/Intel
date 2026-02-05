#!/usr/bin/env npx tsx
/**
 * Deterministic tests for chat utils.
 * Run with: npx tsx scripts/tests/test-chat-utils.ts
 */

import assert from "node:assert/strict"
import { cleanMessagesForTools } from "../../app/api/chat/utils"
import type { ChatMessage, ChatMessagePart } from "../../lib/ai/message-utils"

function makeMessage(parts: ChatMessagePart[] | undefined, role: ChatMessage["role"] = "user"): ChatMessage {
  return {
    id: "m1",
    role,
    parts,
  }
}

function testPlaceholderInsertion() {
  const cleaned = cleanMessagesForTools([makeMessage([])], true, true)
  assert.equal(cleaned.length, 1)
  const parts = cleaned[0].parts || []
  assert.equal(parts.length, 1)
  assert.equal(parts[0].type, "text")
}

function testToolFiltering() {
  const parts: ChatMessagePart[] = [
    { type: "text", text: "hello" },
    {
      type: "tool-invocation",
      toolInvocation: {
        state: "result",
        toolCallId: "t1",
        toolName: "testTool",
        args: { q: "x" },
        result: { ok: true },
      },
    },
  ]

  const cleaned = cleanMessagesForTools([makeMessage(parts)], false, true)
  const cleanedParts = cleaned[0].parts || []
  assert.equal(cleanedParts.some((p) => p.type === "tool-invocation"), false)
  assert.equal(cleanedParts.some((p) => p.type === "text"), true)
}

function testVisionFiltering() {
  const parts: ChatMessagePart[] = [
    { type: "text", text: "hello" },
    { type: "file", url: "https://example.com/file.png", mediaType: "image/png", filename: "file.png" },
  ]

  const cleaned = cleanMessagesForTools([makeMessage(parts)], true, false)
  const cleanedParts = cleaned[0].parts || []
  assert.equal(cleanedParts.some((p) => p.type === "file"), false)
  assert.equal(cleanedParts.some((p) => p.type === "text"), true)
}

function main() {
  testPlaceholderInsertion()
  testToolFiltering()
  testVisionFiltering()
  console.log("✅ chat utils tests passed")
}

main()
