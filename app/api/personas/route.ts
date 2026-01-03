/**
 * Personas API Route
 *
 * GET  /api/personas - List user's personas
 * POST /api/personas - Create a new persona
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listPersonas,
  createPersona,
  PERSONA_ERROR_MESSAGES,
  PERSONA_SUCCESS_MESSAGES,
} from '@/lib/personas'
import type { CreatePersonaRequest } from '@/lib/personas'

/**
 * GET /api/personas
 * List all personas for the authenticated user
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
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Fetch personas
    const result = await listPersonas(supabase, user.id, {
      includeArchived,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] GET /api/personas error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch personas' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/personas
 * Create a new persona
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
    const body = (await req.json()) as CreatePersonaRequest

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: PERSONA_ERROR_MESSAGES.NAME_REQUIRED },
        { status: 400 }
      )
    }

    // Create persona
    const persona = await createPersona(supabase, user.id, body)

    return NextResponse.json(
      {
        message: PERSONA_SUCCESS_MESSAGES.PERSONA_CREATED,
        persona,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API] POST /api/personas error:', error)

    // Check for known error messages
    const errorMessage = error instanceof Error ? error.message : 'Failed to create persona'
    const isValidationError = Object.values(PERSONA_ERROR_MESSAGES).includes(
      errorMessage as (typeof PERSONA_ERROR_MESSAGES)[keyof typeof PERSONA_ERROR_MESSAGES]
    )

    return NextResponse.json(
      { error: errorMessage },
      { status: isValidationError ? 400 : 500 }
    )
  }
}
