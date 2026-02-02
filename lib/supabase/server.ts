import { Database } from "@/app/types/database.types"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isSupabaseEnabled } from "./config"

export const createClient = async () => {
  if (!isSupabaseEnabled) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: any }>) => {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // ignore for middleware
          }
        },
      },
    }
  )
}
