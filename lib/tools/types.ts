import { z } from "zod"

/**
 * Schema for Linkup search parameters
 */
export const linkupSearchParametersSchema = z.object({
  query: z.string().describe("The search query to execute"),
  depth: z
    .enum(["standard", "deep"])
    .optional()
    .default("deep")
    .describe("Search depth: 'deep' (default) for comprehensive results, 'standard' for faster basic search."),
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
