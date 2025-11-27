import { APP_DOMAIN } from "@/lib/config"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Article from "./article"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chatId: string }>
}): Promise<Metadata> {
  if (!isSupabaseEnabled) {
    return {
      title: "Chat",
      description: "A chat in Rōmy",
    }
  }

  const { chatId } = await params

  // Use service role client to bypass RLS for public share pages
  const supabase = await createGuestServerClient()

  if (!supabase) {
    return {
      title: "Chat",
      description: "A chat in Rōmy",
    }
  }

  const { data: chat } = await supabase
    .from("chats")
    .select("title, created_at")
    .eq("id", chatId)
    .eq("public", true)
    .single()

  const title = chat?.title || "Chat"
  const description = "A chat in Rōmy"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${APP_DOMAIN}/share/${chatId}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ShareChat({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  if (!isSupabaseEnabled) {
    return notFound()
  }

  const { chatId } = await params

  // Use service role client to bypass RLS for public share pages
  const supabase = await createGuestServerClient()

  if (!supabase) {
    console.error("[Share] Service role client not available - check SUPABASE_SERVICE_ROLE env var")
    return notFound()
  }

  // Explicitly filter by public = true for security (service role bypasses RLS)
  const { data: chatData, error: chatError } = await supabase
    .from("chats")
    .select("id, title, created_at, public")
    .eq("id", chatId)
    .eq("public", true)
    .single()

  if (chatError) {
    console.error("[Share] Chat query failed:", chatError.message, "for chatId:", chatId)
    redirect("/")
  }

  if (!chatData) {
    console.error("[Share] Chat not found or not public:", chatId)
    redirect("/")
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (messagesError) {
    console.error("[Share] Messages query failed:", messagesError.message)
    redirect("/")
  }

  if (!messagesData) {
    console.error("[Share] No messages found for chat:", chatId)
    redirect("/")
  }

  return (
    <Article
      messages={messagesData}
      date={chatData.created_at || ""}
      title={chatData.title || ""}
      subtitle={"A conversation in Rōmy"}
    />
  )
}
