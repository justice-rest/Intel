import { z } from "zod"

/**
 * Schema for Linkup search parameters
 */
export const linkupSearchParametersSchema = z.object({
  query: z.string().describe("The search query to execute"),
  depth: z
    .enum(["standard", "deep"])
    .optional()
    .default("standard")
    .describe("Search depth: 'standard' is the default and recommended for all searches. Only use 'deep' if explicitly requested by the user."),
})

export type LinkupSearchParameters = z.infer<typeof linkupSearchParametersSchema>

/**
 * Single source from Linkup search
 */
export interface LinkupSource {
  name: string
  url: string
  snippet: string
}

/**
 * Response from Linkup search tool (sourcedAnswer mode)
 */
export interface LinkupSearchResponse {
  answer: string
  sources: LinkupSource[]
  query: string
  depth: "standard" | "deep"
}

/**
 * Tool definition type for Vercel AI SDK
 */
export interface ToolDefinition<TParameters = unknown, TResult = unknown> {
  description: string
  parameters: z.ZodType<TParameters>
  execute: (params: TParameters) => Promise<TResult>
}

// Re-export Exa types
export {
  exaSearchParametersSchema,
  type ExaSearchParameters,
  type ExaSearchResult,
  type ExaSearchResponse,
} from "./exa-search"

// Re-export Tavily types
export {
  tavilySearchParametersSchema,
  type TavilySearchParameters,
  type TavilySearchResult,
  type TavilySearchResponse,
} from "./tavily-search"
