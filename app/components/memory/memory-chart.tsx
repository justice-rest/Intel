"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { MemoryStats } from "@/lib/memory/types"

interface MemoryChartProps {
  stats: MemoryStats
}

interface TimelineDataPoint {
  date: string
  auto: number
  explicit: number
}

const chartConfig = {
  auto: {
    label: "Auto Memories",
    color: "var(--chart-2)",
  },
  explicit: {
    label: "Explicit Memories",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function MemoryChart({ stats }: MemoryChartProps) {
  const [chartData, setChartData] = React.useState<TimelineDataPoint[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch real timeline data from API
  React.useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch("/api/memories/timeline?days=30")
        if (!response.ok) {
          throw new Error("Failed to fetch timeline data")
        }

        const data = await response.json()
        if (data.success && data.timeline) {
          setChartData(data.timeline)
        } else {
          throw new Error(data.error || "Invalid response format")
        }
      } catch (err) {
        console.error("Failed to fetch timeline:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        // Fallback to empty data
        setChartData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchTimeline()
  }, [stats]) // Refetch when stats change

  return (
    <Card className="py-0">
      <CardContent className="px-2 pt-4 sm:p-6 sm:pt-6">
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading timeline...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Unable to load timeline data
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No memory data available yet
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[280px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const dateValue = typeof value === "number" || typeof value === "string"
                    ? value
                    : String(value)
                  const date = new Date(dateValue)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    labelFormatter={(value) => {
                      const dateValue = typeof value === "number" || typeof value === "string"
                        ? value
                        : String(value)
                      return new Date(dateValue).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }}
                  />
                }
              />
              <Bar dataKey="auto" fill="var(--color-auto)" />
              <Bar dataKey="explicit" fill="var(--color-explicit)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
