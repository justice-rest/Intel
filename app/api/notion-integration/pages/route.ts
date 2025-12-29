/**
 * Notion Integration - Pages Route
 *
 * GET /api/notion-integration/pages - List accessible pages and databases
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import {
  getValidAccessToken,
  getAllPages,
  getPageTitle,
  getDatabaseTitle,
  getIconString,
  NOTION_ERROR_MESSAGES,
} from "@/lib/notion"
import type { NotionPage, NotionDatabase } from "@/lib/notion"

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    if (!isSupabaseEnabled) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Get access token
    let accessToken: string
    try {
      accessToken = await getValidAccessToken(user.id)
    } catch {
      return NextResponse.json(
        { error: NOTION_ERROR_MESSAGES.notConnected },
        { status: 400 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("query") || undefined
    const maxPages = parseInt(searchParams.get("limit") || "50", 10)

    // Fetch pages
    const results = await getAllPages(accessToken, {
      query,
      maxPages: Math.min(maxPages, 100),
    })

    // Get already indexed page IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: indexedDocs } = await (supabase as any)
      .from("notion_documents")
      .select("notion_page_id, status")
      .eq("user_id", user.id)

    const indexedMap = new Map<string, string>(
      (indexedDocs || []).map((doc: { notion_page_id: string; status: string }) => [
        doc.notion_page_id,
        doc.status,
      ])
    )

    // Transform results
    const pages = results.map((item) => {
      const isPage = item.object === "page"
      const id = item.id.replace(/-/g, "") // Remove dashes from UUID

      return {
        id,
        title: isPage
          ? getPageTitle(item as NotionPage)
          : getDatabaseTitle(item as NotionDatabase),
        type: item.object as "page" | "database",
        icon: getIconString(item.icon),
        url: item.url,
        lastEditedTime: item.last_edited_time,
        indexed: indexedMap.has(id),
        indexStatus: indexedMap.get(id) || null,
      }
    })

    return NextResponse.json({
      pages,
      total: pages.length,
    })
  } catch (error) {
    console.error("[NotionPages] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch Notion pages" },
      { status: 500 }
    )
  }
}
