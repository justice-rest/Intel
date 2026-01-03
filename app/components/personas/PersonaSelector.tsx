'use client'

/**
 * PersonaSelector Component
 *
 * A dropdown/popover for selecting a persona to assign to a chat.
 * Can also be used to view/change the current chat's persona.
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  User,
  Crown,
  Heart,
  FileText,
  Search,
  Briefcase,
  Check,
  ChevronDown,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react'
import type { PersonaWithProfile } from '@/lib/personas'

// Icon mapping for persona icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  crown: Crown,
  heart: Heart,
  'file-text': FileText,
  search: Search,
  briefcase: Briefcase,
  sparkles: Sparkles,
}

interface PersonaSelectorProps {
  chatId: string
  currentPersonaId: string | null
  currentPersonaName?: string | null
  onPersonaChange?: (personaId: string | null) => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'compact'
}

export function PersonaSelector({
  chatId,
  currentPersonaId,
  currentPersonaName,
  onPersonaChange,
  disabled = false,
  className,
  variant = 'default',
}: PersonaSelectorProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // Fetch user's personas
  const { data: personasData, isLoading: isLoadingPersonas } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const response = await fetch('/api/personas')
      if (!response.ok) throw new Error('Failed to fetch personas')
      return response.json() as Promise<{ personas: PersonaWithProfile[]; total: number }>
    },
    staleTime: 30000, // 30 seconds
  })

  // Mutation to update chat config
  const updateChatConfigMutation = useMutation({
    mutationFn: async (personaId: string | null) => {
      const response = await fetch('/api/chat-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          persona_id: personaId,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update chat config')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate chat config query
      queryClient.invalidateQueries({ queryKey: ['chat-config', chatId] })
    },
  })

  const handleSelectPersona = useCallback(
    async (personaId: string | null) => {
      setOpen(false)

      // Call mutation
      try {
        await updateChatConfigMutation.mutateAsync(personaId)
        onPersonaChange?.(personaId)
      } catch (error) {
        console.error('Failed to update persona:', error)
      }
    },
    [updateChatConfigMutation, onPersonaChange]
  )

  const personas = personasData?.personas || []
  const selectedPersona = personas.find((p) => p.id === currentPersonaId)

  // Render icon based on persona icon field
  const renderIcon = (iconName: string, color: string, size: 'sm' | 'md' = 'md') => {
    const IconComponent = ICON_MAP[iconName] || User
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
    return (
      <div
        className="rounded-full p-1.5 flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <span style={{ color }}>
          <IconComponent className={sizeClass} />
        </span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 gap-1.5 px-2', className)}
            disabled={disabled || updateChatConfigMutation.isPending}
          >
            {updateChatConfigMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : selectedPersona ? (
              renderIcon(selectedPersona.icon, selectedPersona.color, 'sm')
            ) : (
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs truncate max-w-[80px]">
              {selectedPersona?.name || 'Default'}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <PersonaList
            personas={personas}
            selectedId={currentPersonaId}
            isLoading={isLoadingPersonas}
            onSelect={handleSelectPersona}
            renderIcon={renderIcon}
          />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-between', className)}
          disabled={disabled || updateChatConfigMutation.isPending}
        >
          <div className="flex items-center gap-2">
            {updateChatConfigMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : selectedPersona ? (
              <>
                {renderIcon(selectedPersona.icon, selectedPersona.color, 'sm')}
                <span className="truncate">{selectedPersona.name}</span>
              </>
            ) : (
              <>
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Select persona</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <PersonaList
          personas={personas}
          selectedId={currentPersonaId}
          isLoading={isLoadingPersonas}
          onSelect={handleSelectPersona}
          renderIcon={renderIcon}
        />
      </PopoverContent>
    </Popover>
  )
}

// Internal component for the persona list
interface PersonaListProps {
  personas: PersonaWithProfile[]
  selectedId: string | null
  isLoading: boolean
  onSelect: (id: string | null) => void
  renderIcon: (
    iconName: string,
    color: string,
    size?: 'sm' | 'md'
  ) => React.ReactNode
}

function PersonaList({
  personas,
  selectedId,
  isLoading,
  onSelect,
  renderIcon,
}: PersonaListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2">
        <h4 className="text-sm font-medium">Select Persona</h4>
        <p className="text-xs text-muted-foreground">
          Choose how the AI should respond
        </p>
      </div>
      <Separator />
      <ScrollArea className="max-h-[300px]">
        <div className="p-1">
          {/* Default option (no persona) */}
          <button
            className={cn(
              'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left',
              'hover:bg-accent hover:text-accent-foreground',
              'transition-colors',
              !selectedId && 'bg-accent'
            )}
            onClick={() => onSelect(null)}
          >
            <div className="rounded-full p-1.5 bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Default</div>
              <div className="text-xs text-muted-foreground truncate">
                Standard fundraising assistant
              </div>
            </div>
            {!selectedId && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>

          {personas.length > 0 && <Separator className="my-1" />}

          {/* User's personas */}
          {personas.map((persona) => (
            <button
              key={persona.id}
              className={cn(
                'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left',
                'hover:bg-accent hover:text-accent-foreground',
                'transition-colors',
                selectedId === persona.id && 'bg-accent'
              )}
              onClick={() => onSelect(persona.id)}
            >
              {renderIcon(persona.icon, persona.color, 'sm')}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{persona.name}</div>
                {persona.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {persona.description}
                  </div>
                )}
              </div>
              {selectedId === persona.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}

          {personas.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                No custom personas yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create personas in Settings
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default PersonaSelector
