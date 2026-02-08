"use client"

import { NotionIntegrationSection } from "./notion-section"

/**
 * Connectors Section
 *
 * Cloud connectors for document indexing into the RAG system.
 * Includes: Notion
 */
export function ConnectorsSection() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Cloud Connectors
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
            BETA
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect cloud services to import documents for AI-powered search.
        </p>
      </div>

      {/* Notion */}
      <div data-settings-section="notion">
        <NotionIntegrationSection />
      </div>
    </div>
  )
}
