"use client"

import type { MemoryStats } from "@/lib/memory/types"
import { MemoryChart } from "./memory-chart"

interface MemoryStatsProps {
  stats: MemoryStats
}

export function MemoryStats({ stats }: MemoryStatsProps) {
  return <MemoryChart stats={stats} />
}
