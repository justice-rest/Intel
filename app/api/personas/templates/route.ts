/**
 * Persona Templates API Route
 *
 * GET  /api/personas/templates - List available templates
 * POST /api/personas/templates - Clone a template to create a new persona
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listPersonaTemplates,
  cloneFromTemplate,
  PERSONA_ERROR_MESSAGES,
  PERSONA_SUCCESS_MESSAGES,
  PERSONA_TEMPLATE_CATEGORIES,
} from '@/lib/personas'
import type { CloneFromTemplateRequest } from '@/lib/personas'

/**
 * GET /api/personas/templates
 * List all available persona templates
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: PERSONA_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || undefined

    // Validate category if provided
    if (category && !PERSONA_TEMPLATE_CATEGORIES.includes(category as typeof PERSONA_TEMPLATE_CATEGORIES[number])) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Fetch templates
    const templates = await listPersonaTemplates(supabase, { category })

    return NextResponse.json({
      templates,
      categories: PERSONA_TEMPLATE_CATEGORIES,
    })
  } catch (error) {
    console.error('[API] GET /api/personas/templates error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/personas/templates
 * Clone a template to create a new persona
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      )
    }

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: PERSONA_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      )
    }

    // Parse request body
    const body = (await req.json()) as CloneFromTemplateRequest

    // Validate required fields
    if (!body.template_id) {
      return NextResponse.json(
        { error: 'template_id is required' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.template_id)) {
      return NextResponse.json(
        { error: 'Invalid template_id format' },
        { status: 400 }
      )
    }

    // Clone template
    const persona = await cloneFromTemplate(
      supabase,
      user.id,
      body.template_id,
      body.custom_name
    )

    return NextResponse.json(
      {
        message: PERSONA_SUCCESS_MESSAGES.PERSONA_CLONED,
        persona,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API] POST /api/personas/templates error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to clone template'

    // Check for known errors
    if (errorMessage === PERSONA_ERROR_MESSAGES.TEMPLATE_NOT_FOUND) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    const isValidationError = Object.values(PERSONA_ERROR_MESSAGES).includes(
      errorMessage as (typeof PERSONA_ERROR_MESSAGES)[keyof typeof PERSONA_ERROR_MESSAGES]
    )

    return NextResponse.json(
      { error: errorMessage },
      { status: isValidationError ? 400 : 500 }
    )
  }
}
