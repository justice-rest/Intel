/**
 * RAG (Retrieval-Augmented Generation) Type Definitions
 */

export type RAGDocumentStatus = "uploading" | "processing" | "ready" | "failed"

export interface RAGDocument {
  id: string
  user_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  page_count: number | null
  word_count: number | null
  language: string
  tags: string[]
  status: RAGDocumentStatus
  error_message: string | null
  created_at: string
  processed_at: string | null
}

export interface RAGDocumentChunk {
  id: string
  document_id: string
  user_id: string
  chunk_index: number
  content: string
  page_number: number | null
  embedding: number[] | null
  token_count: number | null
  created_at: string
}

export interface RAGSearchResult {
  id: string
  document_id: string
  document_name: string
  content: string
  page_number: number | null
  chunk_index: number
  similarity: number
}

export interface RAGStorageUsage {
  document_count: number
  total_bytes: number
  chunk_count: number
}

export interface RAGCitation {
  document_id: string
  document_name: string
  chunk_ids: string[]
  page_numbers: number[]
  snippets: string[]
}

export interface PDFProcessingResult {
  text: string
  pageCount: number
  wordCount: number
  language: string
}

export interface TextChunk {
  content: string
  pageNumber: number | null
  chunkIndex: number
  tokenCount: number
}

export interface EmbeddingRequest {
  text: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
  model: string
  usage: {
    total_tokens: number
  }
}
