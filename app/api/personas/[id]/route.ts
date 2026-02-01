/**
 * Individual Persona API Route
 *
 * GET    /api/personas/[id] - Get a specific persona
 * PUT    /api/personas/[id] - Update a persona
 * DELETE /api/personas/[id] - Delete a persona (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPersona,
  updatePersona,
  deletePersona,
  PERSONA_ERROR_MESSAGES,
  PERSONA_SUCCESS_MESSAGES,
} from '@/lib/personas'
import type { UpdatePersonaRequest } from '@/lib/personas'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/personas/[id]
 * Get a specific persona by ID
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: personaId } = await context.params

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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(personaId)) {
      return NextResponse.json(
        { error: 'Invalid persona ID format' },
        { status: 400 }
      )
    }

    // Fetch persona
    const persona = await getPersona(supabase as any, personaId, user.id)

    if (!persona) {
      return NextResponse.json(
        { error: PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND },
        { status: 404 }
      )
    }

    return NextResponse.json({ persona })
  } catch (error) {
    console.error('[API] GET /api/personas/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch persona' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/personas/[id]
 * Update a persona
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id: personaId } = await context.params

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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(personaId)) {
      return NextResponse.json(
        { error: 'Invalid persona ID format' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = (await req.json()) as UpdatePersonaRequest

    // Ensure at least one field is being updated
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update persona
    const persona = await updatePersona(supabase as any, personaId, user.id, body)

    return NextResponse.json({
      message: PERSONA_SUCCESS_MESSAGES.PERSONA_UPDATED,
      persona,
    })
  } catch (error) {
    console.error('[API] PUT /api/personas/[id] error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to update persona'

    // Check if it's a not found error
    if (errorMessage === PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    // Check for validation errors
    const isValidationError = Object.values(PERSONA_ERROR_MESSAGES).includes(
      errorMessage as (typeof PERSONA_ERROR_MESSAGES)[keyof typeof PERSONA_ERROR_MESSAGES]
    )

    return NextResponse.json(
      { error: errorMessage },
      { status: isValidationError ? 400 : 500 }
    )
  }
}

/**
 * DELETE /api/personas/[id]
 * Soft delete a persona
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id: personaId } = await context.params

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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(personaId)) {
      return NextResponse.json(
        { error: 'Invalid persona ID format' },
        { status: 400 }
      )
    }

    // Delete persona
    await deletePersona(supabase as any, personaId, user.id)

    return NextResponse.json({
      message: PERSONA_SUCCESS_MESSAGES.PERSONA_DELETED,
    })
  } catch (error) {
    console.error('[API] DELETE /api/personas/[id] error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete persona'

    // Check if it's a not found error
    if (errorMessage === PERSONA_ERROR_MESSAGES.PERSONA_NOT_FOUND) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
