#!/usr/bin/env npx tsx
/**
 * Minimal deterministic tests for message-utils helpers.
 * Run with: npx tsx scripts/tests/test-message-utils.ts
 */

import assert from "node:assert/strict"
import {
  attachmentsToFileParts,
  filePartsToAttachments,
  getMessageAttachments,
  getMessageCreatedAt,
  getMessageParts,
  getMessageText,
  updateMessageText,
  type ChatMessage,
} from "../../lib/ai/message-utils"

function testPartsAndText() {
  const message: ChatMessage = {
    id: "m1",
    role: "user",
    // Legacy content fallback
    content: "Hello world",
  } as ChatMessage

  const parts = getMessageParts(message)
  assert.equal(parts.length, 1)
  assert.equal(parts[0].type, "text")
  assert.equal((parts[0] as { text: string }).text, "Hello world")

  const text = getMessageText(message)
  assert.equal(text, "Hello world")
}

function testUpdateMessageText() {
  const message: ChatMessage = {
    id: "m2",
    role: "assistant",
    parts: [{ type: "text", text: "Old" }],
  }

  const updated = updateMessageText(message, "New")
  assert.equal(getMessageText(updated), "New")
  assert.equal(updated.parts?.[0]?.type, "text")
}

function testAttachmentsRoundTrip() {
  const attachments = [
    { name: "file.txt", contentType: "text/plain", url: "https://example.com/file.txt" },
  ]

  const fileParts = attachmentsToFileParts(attachments)
  assert.equal(fileParts.length, 1)
  assert.equal(fileParts[0].type, "file")

  const roundTrip = filePartsToAttachments(fileParts)
  assert.equal(roundTrip.length, 1)
  assert.equal(roundTrip[0].url, attachments[0].url)
}

function testLegacyAttachments() {
  const message = {
    id: "m3",
    role: "user",
    experimental_attachments: [
      { name: "legacy.pdf", contentType: "application/pdf", url: "https://example.com/legacy.pdf" },
    ],
  } as ChatMessage & { experimental_attachments: unknown }

  const attachments = getMessageAttachments(message)
  assert.equal(attachments.length, 1)
  assert.equal(attachments[0].name, "legacy.pdf")
}

function testCreatedAt() {
  const iso = new Date().toISOString()
  const message: ChatMessage = {
    id: "m4",
    role: "assistant",
    metadata: { createdAt: iso },
    parts: [{ type: "text", text: "Hi" }],
  }

  const date = getMessageCreatedAt(message)
  assert.ok(date)
  assert.equal(date?.toISOString(), iso)
}

function main() {
  testPartsAndText()
  testUpdateMessageText()
  testAttachmentsRoundTrip()
  testLegacyAttachments()
  testCreatedAt()
  console.log("✅ message-utils tests passed")
}

main()
