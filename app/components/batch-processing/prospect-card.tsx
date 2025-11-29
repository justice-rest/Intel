"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  User,
  MapPin,
  CurrencyDollar,
  ChartLineUp,
  Eye,
  Spinner,
  CheckCircle,
  WarningCircle,
  Clock,
  Buildings,
  House,
  ArrowUpRight,
  Link as LinkIcon,
  Globe,
  CaretDown,
  FileText,
} from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"
import type { BatchProspectItem } from "@/lib/batch-processing"
import { Markdown } from "@/components/prompt-kit/markdown"
import Image from "next/image"

// Helper functions for sources display
function getFavicon(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return null
  }
}

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace("www.", "")
  } catch {
    return url
  }
}

interface ProspectCardProps {
  item: BatchProspectItem
  compact?: boolean
}

function StatusBadge({ status }: { status: BatchProspectItem["status"] }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    processing: {
      icon: Spinner,
      label: "Processing",
      className: "bg-blue-500/10 text-blue-500",
      spin: true,
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "bg-green-500/10 text-green-600",
    },
    failed: {
      icon: WarningCircle,
      label: "Failed",
      className: "bg-red-500/10 text-red-500",
    },
    skipped: {
      icon: WarningCircle,
      label: "Skipped",
      className: "bg-yellow-500/10 text-yellow-600",
    },
  }

  const { icon: Icon, label, className, spin } = config[status] as any

  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} weight="fill" />
      {label}
    </Badge>
  )
}

function MetricRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-row">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row gap-2 items-center">
            <div className="bg-foreground text-background rounded-full p-1">
              <Icon className="h-3 w-3" weight="fill" />
            </div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
          <div className={cn("text-2xl font-medium", valueClassName)}>
            {value}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProspectCard({ item, compact = false }: ProspectCardProps) {
  const [showReport, setShowReport] = useState(false)

  const address = [
    item.input_data.address,
    item.input_data.city,
    item.input_data.state,
    item.input_data.zip,
  ]
    .filter(Boolean)
    .join(", ") || item.input_data.full_address || "No address"

  const formatCurrency = (value?: number) => {
    if (!value) return null
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }

  const formatCurrencyFull = (value?: number) => {
    if (!value) return null
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 py-2 px-3 rounded-lg",
          "border border-transparent hover:border-border hover:bg-accent/50 transition-colors"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 text-muted-foreground">
            {item.status === "processing" ? (
              <Spinner className="h-5 w-5 animate-spin text-blue-500" />
            ) : item.status === "completed" ? (
              <CheckCircle className="h-5 w-5 text-green-600" weight="fill" />
            ) : item.status === "failed" ? (
              <WarningCircle className="h-5 w-5 text-red-500" weight="fill" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{item.input_data.name}</p>
            <p className="text-xs text-muted-foreground truncate">{address}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {item.romy_score !== undefined && (
            <Badge variant="outline" className="font-mono">
              {item.romy_score}/41
            </Badge>
          )}
          {item.status === "completed" && item.report_content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReport(true)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Report Dialog */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{item.input_data.name}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{item.report_content || ""}</Markdown>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Full card view - Flight Status inspired design
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 bg-muted rounded-lg p-4"
    >
      {/* Header - Name and Status */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-2">
            <span>#{item.item_index + 1}</span>
            <span>·</span>
            <span>{item.input_data.city}, {item.input_data.state}</span>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <div className="text-lg font-medium">{item.input_data.name}</div>
      </div>

      <div className="h-px grow bg-muted-foreground/20" />

      {/* Completed State - Show Metrics */}
      {item.status === "completed" && (
        <>
          {/* RōmyScore Row */}
          <div className="flex flex-row justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-2 items-center">
                <div className="bg-[#B183FF] text-white rounded-full p-1">
                  <ChartLineUp className="h-3 w-3" weight="fill" />
                </div>
                <div className="text-sm text-muted-foreground">RōmyScore™</div>
              </div>
              <div className="text-2xl sm:text-3xl font-medium">
                {item.romy_score ?? "—"}/41
              </div>
            </div>

            <div className="flex flex-col gap-1 items-end justify-center mt-auto">
              {item.romy_score_tier && (
                <div className={cn(
                  "text-sm rounded-md w-fit px-2",
                  item.romy_score && item.romy_score >= 31
                    ? "bg-purple-400 text-purple-900"
                    : item.romy_score && item.romy_score >= 21
                      ? "bg-green-400 text-green-900"
                      : item.romy_score && item.romy_score >= 11
                        ? "bg-amber-400 text-amber-900"
                        : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {item.romy_score_tier}
                </div>
              )}
              {item.capacity_rating && (
                <div className="text-sm text-muted-foreground">
                  {item.capacity_rating} Gift
                </div>
              )}
            </div>
          </div>

          {/* Metrics Divider */}
          <div className="flex flex-row gap-2 items-center">
            {item.estimated_net_worth && (
              <div className="text-xs text-muted-foreground">
                Est. Worth: {formatCurrency(item.estimated_net_worth)}
              </div>
            )}
            {item.estimated_net_worth && item.recommended_ask && <div>·</div>}
            {item.recommended_ask && (
              <div className="text-xs text-muted-foreground">
                Ask: {formatCurrency(item.recommended_ask)}
              </div>
            )}
            <div className="h-px grow bg-muted-foreground/20 ml-2" />
          </div>

          {/* Wealth Indicators Row */}
          <div className="flex flex-row justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row gap-2 items-center">
                <div className="bg-foreground text-background rounded-full p-1">
                  <CurrencyDollar className="h-3 w-3" weight="fill" />
                </div>
                <div className="text-sm text-muted-foreground">Recommended Ask</div>
              </div>
              <div className="text-2xl sm:text-3xl font-medium text-green-600">
                {formatCurrencyFull(item.recommended_ask) ?? "—"}
              </div>
            </div>

            <div className="flex flex-col gap-1 items-end justify-center mt-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReport(true)}
                className="gap-1"
              >
                <Eye className="h-3 w-3" />
                View Report
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Processing State */}
      {item.status === "processing" && (
        <div className="flex items-center gap-3 py-4">
          <Spinner className="h-6 w-6 animate-spin text-blue-500" />
          <div>
            <p className="text-sm font-medium">Researching prospect...</p>
            <p className="text-xs text-muted-foreground">
              Running web searches and generating report
            </p>
          </div>
        </div>
      )}

      {/* Pending State */}
      {item.status === "pending" && (
        <div className="flex items-center gap-3 py-4">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Waiting to process</p>
            <p className="text-xs text-muted-foreground">
              {address}
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {item.status === "failed" && (
        <div className="py-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <WarningCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-medium text-red-500">Research failed</p>
              <p className="text-xs text-red-500/80 mt-1">{item.error_message}</p>
              {item.retry_count > 0 && (
                <p className="text-xs text-red-400 mt-1">
                  Attempted {item.retry_count} time(s)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Dialog with Tabs for Report and Sources */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{item.input_data.name}</span>
              {item.romy_score !== undefined && (
                <Badge className="bg-[#B183FF]/20 text-[#B183FF] border-[#B183FF]/30">
                  RōmyScore: {item.romy_score}/41
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="report" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="report" className="gap-2">
                <FileText className="h-4 w-4" />
                Report
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-2">
                <Globe className="h-4 w-4" />
                Sources
                {item.sources_found && item.sources_found.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {item.sources_found.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="report" className="mt-4">
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{item.report_content || ""}</Markdown>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sources" className="mt-4">
              <ScrollArea className="max-h-[60vh] pr-4">
                {item.sources_found && item.sources_found.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      {item.sources_found.length} sources were used to generate this report.
                    </p>
                    <div className="space-y-2">
                      {item.sources_found.map((source, index) => {
                        const faviconUrl = getFavicon(source.url)
                        return (
                          <a
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {faviconUrl ? (
                                <Image
                                  src={faviconUrl}
                                  alt=""
                                  width={20}
                                  height={20}
                                  className="rounded"
                                />
                              ) : (
                                <div className="h-5 w-5 bg-muted rounded flex items-center justify-center">
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate group-hover:text-primary">
                                  {source.name || formatUrl(source.url)}
                                </span>
                                <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                              </div>
                              <span className="text-xs text-muted-foreground truncate block">
                                {formatUrl(source.url)}
                              </span>
                            </div>
                          </a>
                        )
                      })}
                    </div>

                    {/* Search queries used */}
                    {item.search_queries_used && item.search_queries_used.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Search Queries Used</h4>
                        <div className="space-y-2">
                          {item.search_queries_used.map((query, index) => (
                            <div
                              key={index}
                              className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md"
                            >
                              {query}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">
                      No sources available for this report.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Web search may have been disabled for this batch job.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
