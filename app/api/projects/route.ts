import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    const userId = authData.user.id

    const { name } = await request.json()

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, user_id: userId })
      .select()
      .single()

    if (error) {
      console.error("Projects POST error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error("Projects POST unhandled error:", err)

    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()

    const userId = authData?.user?.id
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Projects GET error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error("Projects GET unhandled error:", err)

    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}
