"use client"

import { getSources } from "@/app/components/chat/get-sources"
import { Reasoning } from "@/app/components/chat/reasoning"
import { SearchImages } from "@/app/components/chat/search-images"
import { SourcesList } from "@/app/components/chat/sources-list"
import { ToolInvocation } from "@/app/components/chat/tool-invocation"
import type { Tables } from "@/app/types/database.types"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/prompt-kit/message"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/config"
import { exportToPdf } from "@/lib/pdf-export"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Message as MessageAISDK } from "@ai-sdk/react"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"
import { Check, Copy, FilePdf, SpinnerGap } from "@phosphor-icons/react"
import Link from "next/link"
import React, { useEffect, useState } from "react"
import { Header } from "./header"

type MessageType = Tables<"messages">

type ArticleProps = {
  date: string
  title: string
  subtitle: string
  messages: MessageType[]
}

export default function Article({
  date,
  title,
  subtitle,
  messages,
}: ArticleProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [authHref, setAuthHref] = useState("/auth")

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      if (!supabase) {
        setAuthHref("/auth")
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      // If authenticated (and not a guest), go to home; otherwise go to auth
      if (user && !user.is_anonymous) {
        setAuthHref("/")
      } else {
        setAuthHref("/auth")
      }
    }

    checkAuth()
  }, [])

  const copyToClipboard = (messageId: number, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExportPdf = async (messageId: number, content: string) => {
    setExportingId(messageId)
    try {
      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      await exportToPdf(content, {
        title,
        date: formattedDate,
        logoSrc: "/BrandmarkRōmy.png",
      })
    } catch (error) {
      console.error("Failed to export PDF:", error)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <>
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <time
            dateTime={new Date(date).toISOString().split("T")[0]}
            className="text-foreground"
          >
            {new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          {title}
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">{subtitle}</p>

        <div className="fixed bottom-6 left-0 z-50 flex w-full justify-center">
          <Link href={authHref}>
            <Button
              variant="outline"
              className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
            >
              Ask {APP_NAME}
              <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
              </div>
            </Button>
          </Link>
        </div>
        <div className="mt-20 w-full">
          {messages.map((message) => {
            const parts = message?.parts as MessageAISDK["parts"]
            const sources = getSources(parts)

            // Extract different types of parts for proper rendering
            const toolInvocationParts = parts?.filter(
              (part) => part.type === "tool-invocation"
            )
            const reasoningParts = parts?.find((part) => part.type === "reasoning")
            const searchImageResults =
              parts
                ?.filter(
                  (part) =>
                    part.type === "tool-invocation" &&
                    part.toolInvocation?.state === "result" &&
                    part.toolInvocation?.toolName === "imageSearch" &&
                    part.toolInvocation?.result?.content?.[0]?.type === "images"
                )
                .flatMap((part) =>
                  part.type === "tool-invocation" &&
                  part.toolInvocation?.state === "result" &&
                  part.toolInvocation?.toolName === "imageSearch" &&
                  part.toolInvocation?.result?.content?.[0]?.type === "images"
                    ? (part.toolInvocation?.result?.content?.[0]?.results ?? [])
                    : []
                ) ?? []

            const contentNullOrEmpty = !message.content || message.content === ""

            return (
              <div key={message.id} className="mb-8">
                <Message
                  className={cn(
                    "group mb-4 flex flex-col gap-0",
                    message.role === "assistant" && "w-full items-start",
                    message.role === "user" && "w-full items-end"
                  )}
                >
                  <div className={cn(
                    "flex flex-col gap-2 overflow-hidden",
                    message.role === "assistant" && "min-w-full max-w-full",
                    message.role === "user" && "max-w-[85%]"
                  )}>
                    {/* Render reasoning for assistant messages */}
                    {message.role === "assistant" && reasoningParts && reasoningParts.reasoning && (
                      <Reasoning
                        reasoning={reasoningParts.reasoning}
                        isStreaming={false}
                      />
                    )}

                    {/* Render tool invocations for assistant messages - always show in share view */}
                    {message.role === "assistant" &&
                      toolInvocationParts &&
                      toolInvocationParts.length > 0 && (
                        <ToolInvocation toolInvocations={toolInvocationParts} />
                      )}

                    {/* Render search images for assistant messages */}
                    {message.role === "assistant" && searchImageResults.length > 0 && (
                      <SearchImages results={searchImageResults} />
                    )}

                    {/* Render message content if not empty */}
                    {!contentNullOrEmpty && (
                      <MessageContent
                        markdown={true}
                        className={cn(
                          message.role === "user" &&
                            "bg-[var(--color-blue-600)] text-white prose prose-p:my-0 w-fit max-w-full rounded-3xl px-5 py-2",
                          message.role === "assistant" &&
                            "prose dark:prose-invert w-full min-w-full bg-transparent",
                          "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
                        )}
                        {...(message.role === "user" && {
                          components: {
                            code: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
                            pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
                            h1: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            h2: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            h3: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            h4: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            h5: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            h6: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            p: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
                            li: ({ children }: { children?: React.ReactNode }) => <p>- {children}</p>,
                            ul: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
                            ol: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
                          },
                        })}
                      >
                        {message.content!}
                      </MessageContent>
                    )}

                    {/* Render sources for assistant messages */}
                    {message.role === "assistant" && sources && sources.length > 0 && (
                      <SourcesList sources={sources} />
                    )}

                    {/* Copy and Export PDF buttons for assistant messages */}
                    {message.role === "assistant" && !contentNullOrEmpty && (
                      <MessageActions
                        className={cn(
                          "-ml-1 flex gap-0"
                        )}
                      >
                        <MessageAction
                          tooltip={copiedId === message.id ? "Copied!" : "Copy text"}
                          side="bottom"
                        >
                          <button
                            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
                            aria-label="Copy text"
                            onClick={() => copyToClipboard(message.id, message.content!)}
                            type="button"
                          >
                            {copiedId === message.id ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        </MessageAction>
                        <MessageAction
                          tooltip={exportingId === message.id ? "Exporting..." : "Export PDF"}
                          side="bottom"
                        >
                          <button
                            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition disabled:opacity-50"
                            aria-label="Export PDF"
                            onClick={() => handleExportPdf(message.id, message.content!)}
                            type="button"
                            disabled={exportingId === message.id}
                          >
                            {exportingId === message.id ? (
                              <SpinnerGap className="size-4 animate-spin" />
                            ) : (
                              <FilePdf className="size-4" />
                            )}
                          </button>
                        </MessageAction>
                      </MessageActions>
                    )}
                  </div>
                </Message>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}