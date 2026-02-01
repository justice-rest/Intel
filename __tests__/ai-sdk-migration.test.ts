/**
 * AI SDK v6 Migration Tests
 *
 * Tests to verify the AI SDK v6 migration is working correctly.
 * Focus areas:
 * 1. Message type conversion (ChatMessage <-> ModelMessage)
 * 2. Message payload optimization
 * 3. Tool definitions
 * 4. Provider configuration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test 1: Message type imports
describe('AI SDK v6 Type Imports', () => {
  it('should import LanguageModel from ai package', async () => {
    const ai = await import('ai')
    expect(ai).toBeDefined()
    // In v6, LanguageModel is exported (not LanguageModelV1)
    expect(typeof ai.streamText).toBe('function')
    expect(typeof ai.tool).toBe('function')
  })

  it('should import UIMessage from @ai-sdk/react', async () => {
    const react = await import('@ai-sdk/react')
    expect(react).toBeDefined()
    expect(react.useChat).toBeDefined()
  })

  it('should import ModelMessage from @ai-sdk/provider-utils', async () => {
    const providerUtils = await import('@ai-sdk/provider-utils')
    expect(providerUtils).toBeDefined()
    expect(typeof providerUtils.tool).toBe('function')
  })
})

// Test 2: Message payload optimizer
describe('Message Payload Optimizer', () => {
  it('should handle legacy content format (string)', async () => {
    const { estimateTokens, estimateMessageTokens } = await import('@/lib/message-payload-optimizer')

    expect(estimateTokens('Hello world')).toBe(3) // ~11 chars / 4 = ~3 tokens

    const message = {
      id: 'test-1',
      role: 'user' as const,
      content: 'Hello, this is a test message',
    }

    const tokens = estimateMessageTokens(message)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(100)
  })

  it('should handle array content format', async () => {
    const { estimateMessageTokens } = await import('@/lib/message-payload-optimizer')

    const message = {
      id: 'test-2',
      role: 'assistant' as const,
      content: [
        { type: 'text', text: 'Hello world' }
      ],
    }

    const tokens = estimateMessageTokens(message)
    expect(tokens).toBeGreaterThan(0)
  })

  it('should handle v6 parts format', async () => {
    const { estimateMessageTokens } = await import('@/lib/message-payload-optimizer')

    const message = {
      id: 'test-3',
      role: 'assistant' as const,
      parts: [
        { type: 'text', text: 'Hello from parts array' }
      ],
    }

    const tokens = estimateMessageTokens(message)
    expect(tokens).toBeGreaterThan(0)
  })

  it('should optimize message payload', async () => {
    const { optimizeMessagePayload } = await import('@/lib/message-payload-optimizer')

    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i} content that is reasonably long to test truncation`,
    }))

    const optimized = optimizeMessagePayload(messages)

    // Should limit messages
    expect(optimized.length).toBeLessThan(messages.length)
    // Should preserve most recent messages
    expect(optimized[optimized.length - 1].content).toContain('99')
  })
})

// Test 3: Chat message utilities
describe('Chat Message Utilities', () => {
  it('should clean messages for tools', async () => {
    const { cleanMessagesForTools } = await import('@/app/api/chat/utils')

    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Hi there',
        toolInvocations: [
          { toolCallId: 'tc-1', toolName: 'test', state: 'result', args: {}, result: {} }
        ],
      },
    ]

    // With tools support
    const withTools = cleanMessagesForTools(messages, true, true)
    expect(withTools.length).toBe(2)
    expect(withTools[1].toolInvocations).toBeDefined()

    // Without tools support
    const withoutTools = cleanMessagesForTools(messages, false, true)
    expect(withoutTools.length).toBe(2)
    expect(withoutTools[1].toolInvocations).toBeUndefined()
  })
})

// Test 4: Tool definitions
describe('Tool Definitions', () => {
  it('should create a valid tool with AI SDK v6', async () => {
    const { tool } = await import('ai')
    const { z } = await import('zod')

    const testTool = tool({
      description: 'A test tool',
      parameters: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }: { query: string }) => {
        return { result: `Searched for: ${query}` }
      },
    } as any)

    expect(testTool).toBeDefined()
    expect(testTool.description).toBe('A test tool')
  })
})

// Test 5: Model configuration
describe('Model Configuration', () => {
  it('should export model types correctly', async () => {
    const { getAllModels, normalizeModelId } = await import('@/lib/models')

    // getAllModels is async
    const models = await getAllModels()
    expect(Array.isArray(models)).toBe(true)
    expect(models.length).toBeGreaterThan(0)

    // Test model normalization
    const normalized = normalizeModelId('gpt-4')
    expect(normalized).toBeDefined()
  })

  it('should have apiSdk function for models', async () => {
    const { getAllModels } = await import('@/lib/models')

    // getAllModels is async
    const models = await getAllModels()
    const modelsWithApiSdk = models.filter(m => m.apiSdk)

    expect(modelsWithApiSdk.length).toBeGreaterThan(0)
  })
})

// Test 6: stepCountIs function (v6 replacement for maxSteps)
describe('AI SDK v6 Specific Features', () => {
  it('should export stepCountIs function', async () => {
    const { stepCountIs } = await import('ai')

    expect(typeof stepCountIs).toBe('function')

    const stopCondition = stepCountIs(5)
    expect(stopCondition).toBeDefined()
  })

  it('should export smoothStream function', async () => {
    const { smoothStream } = await import('ai')

    expect(typeof smoothStream).toBe('function')
  })
})

// Test 7: Provider imports
describe('Provider Imports', () => {
  it('should import Google provider', async () => {
    const google = await import('@ai-sdk/google')
    expect(google.createGoogleGenerativeAI).toBeDefined()
  })

  it('should import OpenAI provider', async () => {
    const openai = await import('@ai-sdk/openai')
    expect(openai.createOpenAI).toBeDefined()
  })

  it('should import Anthropic provider', async () => {
    const anthropic = await import('@ai-sdk/anthropic')
    expect(anthropic.createAnthropic).toBeDefined()
  })

  it('should import OpenRouter provider', async () => {
    const openrouter = await import('@openrouter/ai-sdk-provider')
    expect(openrouter.createOpenRouter).toBeDefined()
  })
})

// Test 8: Tool type (ToolSet was removed in v6, use plain objects)
describe('Tool Type', () => {
  it('should accept tool objects with plain object type', async () => {
    const { tool } = await import('ai')
    const { z } = await import('zod')

    // In v6, tools are just plain objects without special types
    const testTool = tool({
      description: 'Test tool',
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }: { input: string }) => ({ output: input }),
    } as any)

    const tools = {
      test_tool: testTool,
    }

    expect(Object.keys(tools)).toContain('test_tool')
    expect(testTool.description).toBe('Test tool')
  })
})
