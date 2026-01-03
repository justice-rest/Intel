'use client'

/**
 * PersonaManager Component
 *
 * Full persona management interface for the settings page.
 * Allows creating, editing, and deleting personas.
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  User,
  Crown,
  Heart,
  FileText,
  Search,
  Briefcase,
  Loader2,
  Sparkles,
  Star,
  Target,
  Zap,
  Shield,
  Bot,
} from 'lucide-react'
import type {
  PersonaWithProfile,
  PersonaTemplate,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  PersonaVoiceConfig,
  SystemPromptMode,
  VoiceTone,
} from '@/lib/personas'
import {
  SYSTEM_PROMPT_MODES,
  PERSONA_ICONS,
  PERSONA_COLORS,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
} from '@/lib/personas'

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  crown: Crown,
  heart: Heart,
  'file-text': FileText,
  search: Search,
  briefcase: Briefcase,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  zap: Zap,
  shield: Shield,
  bot: Bot,
}

interface PersonaManagerProps {
  className?: string
}

export function PersonaManager({ className }: PersonaManagerProps) {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<PersonaWithProfile | null>(null)

  // Fetch personas
  const { data: personasData, isLoading: isLoadingPersonas } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const response = await fetch('/api/personas')
      if (!response.ok) throw new Error('Failed to fetch personas')
      return response.json() as Promise<{ personas: PersonaWithProfile[]; total: number }>
    },
  })

  // Fetch templates
  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['persona-templates'],
    queryFn: async () => {
      const response = await fetch('/api/personas/templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      return response.json() as Promise<{ templates: PersonaTemplate[] }>
    },
    enabled: showTemplatesDialog,
  })

  // Create persona mutation
  const createPersonaMutation = useMutation({
    mutationFn: async (data: CreatePersonaRequest) => {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create persona')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      setShowCreateDialog(false)
    },
  })

  // Update persona mutation
  const updatePersonaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePersonaRequest }) => {
      const response = await fetch(`/api/personas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update persona')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      setShowEditDialog(false)
      setSelectedPersona(null)
    },
  })

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete persona')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      setShowDeleteDialog(false)
      setSelectedPersona(null)
    },
  })

  // Clone from template mutation
  const cloneTemplateMutation = useMutation({
    mutationFn: async ({ templateId, customName }: { templateId: string; customName?: string }) => {
      const response = await fetch('/api/personas/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, custom_name: customName }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to clone template')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      setShowTemplatesDialog(false)
    },
  })

  const personas = personasData?.personas || []
  const templates = templatesData?.templates || []

  const handleEdit = useCallback((persona: PersonaWithProfile) => {
    setSelectedPersona(persona)
    setShowEditDialog(true)
  }, [])

  const handleDelete = useCallback((persona: PersonaWithProfile) => {
    setSelectedPersona(persona)
    setShowDeleteDialog(true)
  }, [])

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = ICON_MAP[iconName] || User
    return (
      <div
        className="rounded-full p-2 flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <span style={{ color }}>
          <IconComponent className="h-5 w-5" />
        </span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Personas</h3>
          <p className="text-sm text-muted-foreground">
            Create different AI personalities for various use cases
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesDialog(true)}
          >
            <Copy className="h-4 w-4 mr-2" />
            From Template
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Persona
          </Button>
        </div>
      </div>

      {/* Personas List */}
      {isLoadingPersonas ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : personas.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/20">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h4 className="font-medium mb-1">No personas yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first persona or start from a template
          </p>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesDialog(true)}
            >
              Browse Templates
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              Create Persona
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {renderIcon(persona.icon, persona.color)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{persona.name}</h4>
                    {persona.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  {persona.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {persona.description}
                    </p>
                  )}
                  {persona.knowledge_profile && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Knowledge: {persona.knowledge_profile.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(persona)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(persona)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <PersonaFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Create Persona"
        description="Create a new AI persona with custom behavior"
        isLoading={createPersonaMutation.isPending}
        error={createPersonaMutation.error?.message}
        onSubmit={(data) => createPersonaMutation.mutate(data as CreatePersonaRequest)}
      />

      {/* Edit Dialog */}
      {selectedPersona && (
        <PersonaFormDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          title="Edit Persona"
          description={`Update ${selectedPersona.name}`}
          initialData={selectedPersona}
          isLoading={updatePersonaMutation.isPending}
          error={updatePersonaMutation.error?.message}
          onSubmit={(data) =>
            updatePersonaMutation.mutate({ id: selectedPersona.id, data: data as UpdatePersonaRequest })
          }
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedPersona?.name}&quot;? This
              action cannot be undone. Any chats using this persona will revert
              to the default behavior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedPersona && deletePersonaMutation.mutate(selectedPersona.id)}
              disabled={deletePersonaMutation.isPending}
            >
              {deletePersonaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Persona Templates</DialogTitle>
            <DialogDescription>
              Start with a pre-configured persona template
            </DialogDescription>
          </DialogHeader>
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="grid gap-3 pr-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {renderIcon(template.icon, template.color)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {template.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          cloneTemplateMutation.mutate({ templateId: template.id })
                        }
                        disabled={cloneTemplateMutation.isPending}
                      >
                        {cloneTemplateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Use'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Form Dialog Component
interface PersonaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initialData?: PersonaWithProfile
  isLoading: boolean
  error?: string
  onSubmit: (data: CreatePersonaRequest | UpdatePersonaRequest) => void
}

function PersonaFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initialData,
  isLoading,
  error,
  onSubmit,
}: PersonaFormDialogProps) {
  const [formData, setFormData] = useState<CreatePersonaRequest>(() => ({
    name: initialData?.name || '',
    description: initialData?.description || '',
    icon: initialData?.icon || 'user',
    color: initialData?.color || '#6366f1',
    system_prompt: initialData?.system_prompt || '',
    system_prompt_mode: initialData?.system_prompt_mode || 'append',
    voice_config: initialData?.voice_config || {},
    is_default: initialData?.is_default || false,
  }))

  // Reset form when dialog opens with new data
  useState(() => {
    if (open && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        icon: initialData.icon,
        color: initialData.color,
        system_prompt: initialData.system_prompt || '',
        system_prompt_mode: initialData.system_prompt_mode,
        voice_config: initialData.voice_config,
        is_default: initialData.is_default,
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="e.g., Major Gifts Specialist"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Icon & Color</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.icon}
                    onValueChange={(value) =>
                      setFormData({ ...formData, icon: value })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ICON_MAP).map(([key, Icon]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="capitalize">{key}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    {PERSONA_COLORS.slice(0, 5).map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          formData.color === color
                            ? 'border-primary scale-110'
                            : 'border-transparent hover:scale-105'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="Brief description of this persona's purpose"
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* System Prompt */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="system_prompt">Custom Instructions</Label>
                <Select
                  value={formData.system_prompt_mode}
                  onValueChange={(value: SystemPromptMode) =>
                    setFormData({ ...formData, system_prompt_mode: value })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append</SelectItem>
                    <SelectItem value="prepend">Prepend</SelectItem>
                    <SelectItem value="full">Replace All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                id="system_prompt"
                value={formData.system_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, system_prompt: e.target.value })
                }
                maxLength={MAX_SYSTEM_PROMPT_LENGTH}
                placeholder="Additional instructions for the AI when using this persona..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {formData.system_prompt_mode === 'append' &&
                  'These instructions will be added after the default system prompt.'}
                {formData.system_prompt_mode === 'prepend' &&
                  'These instructions will be added before the default system prompt.'}
                {formData.system_prompt_mode === 'full' &&
                  'This will completely replace the default system prompt.'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Voice Configuration */}
          <div className="space-y-4">
            <Label>Voice & Tone</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tone" className="text-sm font-normal">
                  Tone
                </Label>
                <Select
                  value={(formData.voice_config as PersonaVoiceConfig)?.tone || ''}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      voice_config: {
                        ...formData.voice_config,
                        tone: value as VoiceTone,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="formality" className="text-sm font-normal">
                  Formality Level
                </Label>
                <Select
                  value={
                    String(
                      (formData.voice_config as PersonaVoiceConfig)?.formality_level || ''
                    )
                  }
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      voice_config: {
                        ...formData.voice_config,
                        formality_level: parseInt(value) as 1 | 2 | 3 | 4 | 5,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Very Casual</SelectItem>
                    <SelectItem value="2">Casual</SelectItem>
                    <SelectItem value="3">Balanced</SelectItem>
                    <SelectItem value="4">Professional</SelectItem>
                    <SelectItem value="5">Highly Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="use_emojis"
                checked={(formData.voice_config as PersonaVoiceConfig)?.use_emojis || false}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    voice_config: {
                      ...formData.voice_config,
                      use_emojis: checked,
                    },
                  })
                }
              />
              <Label htmlFor="use_emojis" className="font-normal">
                Allow emojis in responses
              </Label>
            </div>
          </div>

          <Separator />

          {/* Default Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="is_default"
              checked={formData.is_default || false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_default: checked })
              }
            />
            <Label htmlFor="is_default" className="font-normal">
              Set as default persona for new chats
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {initialData ? 'Save Changes' : 'Create Persona'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PersonaManager
