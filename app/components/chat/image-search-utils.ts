import type { ImageResult } from "./search-images"

type ImageSearchContentBlock = {
  type: string
  results?: unknown
}

type ImageSearchToolResult = {
  content?: unknown
}

function isImageSearchContentBlock(value: unknown): value is ImageSearchContentBlock {
  return !!value && typeof value === "object" && "type" in value
}

function isImageResult(value: unknown): value is ImageResult {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.title === "string" &&
    typeof record.imageUrl === "string" &&
    typeof record.sourceUrl === "string"
  )
}

export function extractImageSearchResults(result: unknown): ImageResult[] {
  if (!result || typeof result !== "object") return []

  const content = (result as ImageSearchToolResult).content
  if (!Array.isArray(content)) return []

  const imagesBlock = content.find(
    (item) =>
      isImageSearchContentBlock(item) &&
      item.type === "images"
  ) as ImageSearchContentBlock | undefined

  if (!imagesBlock || !Array.isArray(imagesBlock.results)) return []

  return imagesBlock.results.filter(isImageResult)
}
