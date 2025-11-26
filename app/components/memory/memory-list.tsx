"use client"

import { useState, useEffect, useMemo } from "react"
import { useMemory } from "@/lib/memory-store"
import { MemoryCard } from "./memory-card"
import { MemoryForm } from "./memory-form"
import { MemoryStats } from "./memory-stats"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MagnifyingGlass, Plus, Brain, Spinner } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "motion/react"

export function MemoryList() {
  const { memories, stats, isLoading, searchMemories } = useMemory()
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [semanticResults, setSemanticResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Immediate local filtering for instant feedback
  const localFilteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories

    const query = searchQuery.toLowerCase()
    return memories.filter((memory) =>
      memory.content.toLowerCase().includes(query)
    )
  }, [memories, searchQuery])

  // Debounced semantic search using API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSemanticResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchMemories(searchQuery, { limit: 20 })
        setSemanticResults(results)
      } catch (error) {
        console.error("Semantic search failed:", error)
        // Fall back to local results on error
        setSemanticResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchMemories])

  // Show semantic results if available, otherwise local filtered results
  const displayedMemories = semanticResults.length > 0 ? semanticResults : localFilteredMemories

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500">
        {stats && <MemoryStats stats={stats} />}
      </div>

      {/* Search and Add */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500 delay-100 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 transition-all focus-visible:ring-2"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        <Button onClick={() => setShowForm(true)} size="lg">
          <Plus className="h-5 w-5" weight="bold" />
          Add Memory
        </Button>
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-6">
        {memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Brain className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No memories yet. The AI will automatically save important facts as you chat.
            </p>
          </div>
        ) : displayedMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <MagnifyingGlass className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No memories match your search.
            </p>
          </div>
        ) : (
          <motion.div layout className="space-y-2">
            <AnimatePresence mode="popLayout">
              {displayedMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && <MemoryForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
