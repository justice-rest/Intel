"use client"

import { GoogleIntegrationSection } from "../integrations/google-section"
import { NotionIntegrationSection } from "./notion-section"

/**
 * Connectors Section
 *
 * Cloud connectors for document indexing into the RAG system.
 * Includes: Google Workspace, Notion
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

      {/* Google Workspace */}
      <div data-settings-section="google-workspace">
        <GoogleIntegrationSection />
      </div>

      {/* Notion */}
      <div data-settings-section="notion" className="border-t pt-6">
        <NotionIntegrationSection />
      </div>
    </div>
  )
}
