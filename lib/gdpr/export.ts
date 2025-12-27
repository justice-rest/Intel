/**
 * GDPR Data Export
 * Gathers user data for export in a human-readable format
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExportOptions,
  ExportData,
  ExportChat,
  ExportMessage,
  ExportAttachment,
  ExportMemory,
  ExportConstituent,
  ExportDonation,
  ExportSection,
} from './types'

// Use a more flexible type to handle tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>

/**
 * Gather all user data for export based on selected sections
 */
export async function gatherExportData(
  supabase: AnySupabaseClient,
  userId: string,
  options: ExportOptions
): Promise<ExportData> {
  const sections = options.sections.includes('all')
    ? ['profile', 'preferences', 'chats', 'memories', 'crm'] as ExportSection[]
    : options.sections

  const exportData: ExportData = {
    exportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    requestedSections: sections,
  }

  // Gather data in parallel where possible
  const promises: Promise<void>[] = []

  if (sections.includes('profile')) {
    promises.push(
      gatherProfile(supabase, userId).then(data => {
        exportData.profile = data
      })
    )
  }

  if (sections.includes('preferences')) {
    promises.push(
      gatherPreferences(supabase, userId).then(data => {
        exportData.preferences = data
      })
    )
  }

  if (sections.includes('chats')) {
    promises.push(
      gatherChats(supabase, userId, options.includeAttachments).then(data => {
        exportData.chats = data
      })
    )
  }

  if (sections.includes('memories')) {
    promises.push(
      gatherMemories(supabase, userId).then(data => {
        exportData.memories = data
      })
    )
  }

  if (sections.includes('crm')) {
    promises.push(
      gatherCrmData(supabase, userId).then(data => {
        exportData.crmData = data
      })
    )
  }

  await Promise.all(promises)

  return exportData
}

/**
 * Gather user profile data
 */
async function gatherProfile(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ExportData['profile']> {
  const { data: user } = await supabase
    .from('users')
    .select('email, display_name, first_name, created_at, system_prompt, welcome_completed')
    .eq('id', userId)
    .single()

  if (!user) {
    return undefined
  }

  return {
    email: user.email || '',
    displayName: user.display_name,
    firstName: user.first_name,
    createdAt: user.created_at || new Date().toISOString(),
    systemPrompt: user.system_prompt,
    welcomeCompleted: user.welcome_completed || false,
  }
}

/**
 * Gather user preferences
 */
async function gatherPreferences(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ExportData['preferences']> {
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('layout, prompt_suggestions, show_tool_invocations, show_conversation_previews, hidden_models')
    .eq('user_id', userId)
    .single()

  const { data: user } = await supabase
    .from('users')
    .select('favorite_models')
    .eq('id', userId)
    .single()

  return {
    layout: prefs?.layout || 'sidebar',
    promptSuggestions: prefs?.prompt_suggestions ?? true,
    showToolInvocations: prefs?.show_tool_invocations ?? true,
    showConversationPreviews: prefs?.show_conversation_previews ?? true,
    hiddenModels: (prefs?.hidden_models as string[]) || [],
    favoriteModels: (user?.favorite_models as string[]) || [],
  }
}

/**
 * Gather all chats with messages
 */
async function gatherChats(
  supabase: AnySupabaseClient,
  userId: string,
  includeAttachments?: boolean
): Promise<ExportChat[]> {
  // First, get all chats
  const { data: chats } = await supabase
    .from('chats')
    .select('id, title, model, system_prompt, pinned, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (!chats || chats.length === 0) {
    return []
  }

  // Then get all messages for these chats
  const chatIds = chats.map(c => c.id)
  const { data: messages } = await supabase
    .from('messages')
    .select('chat_id, role, content, model, created_at, experimental_attachments')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: true })

  // Group messages by chat
  const messagesByChat = new Map<string, typeof messages>()
  for (const msg of messages || []) {
    const existing = messagesByChat.get(msg.chat_id) || []
    existing.push(msg)
    messagesByChat.set(msg.chat_id, existing)
  }

  // Build export chats
  return chats.map(chat => {
    const chatMessages = messagesByChat.get(chat.id) || []

    return {
      title: chat.title,
      model: chat.model,
      systemPrompt: chat.system_prompt,
      pinned: chat.pinned || false,
      createdAt: chat.created_at || new Date().toISOString(),
      updatedAt: chat.updated_at || chat.created_at || new Date().toISOString(),
      messages: chatMessages.map(msg => {
        const exportMsg: ExportMessage = {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content || '',
          model: msg.model,
          createdAt: msg.created_at || new Date().toISOString(),
        }

        // Include attachment metadata (but not the actual files unless requested)
        if (msg.experimental_attachments) {
          const attachments = msg.experimental_attachments as Array<{
            name?: string
            contentType?: string
            size?: number
          }>

          if (attachments.length > 0) {
            exportMsg.attachments = attachments.map(att => ({
              fileName: att.name || 'unknown',
              fileType: att.contentType || 'application/octet-stream',
              fileSize: att.size || 0,
            }))
          }
        }

        return exportMsg
      }),
    }
  })
}

/**
 * Gather AI memories
 */
async function gatherMemories(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ExportMemory[]> {
  // Try v2 memories first
  const { data: memoriesV2 } = await supabase
    .from('memories_v2')
    .select('content, category, importance_score, memory_type, created_at, last_accessed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (memoriesV2 && memoriesV2.length > 0) {
    return memoriesV2.map(mem => ({
      content: mem.content || '',
      category: mem.category,
      importance: mem.importance_score || 0.5,
      memoryType: (mem.memory_type === 'explicit' ? 'explicit' : 'automatic') as 'explicit' | 'automatic',
      createdAt: mem.created_at || new Date().toISOString(),
      lastAccessedAt: mem.last_accessed_at,
    }))
  }

  // Fall back to v1 memories
  const { data: memoriesV1 } = await supabase
    .from('user_memories')
    .select('content, category, importance_score, memory_type, created_at, last_accessed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (memoriesV1 && memoriesV1.length > 0) {
    return memoriesV1.map(mem => ({
      content: mem.content || '',
      category: mem.category,
      importance: mem.importance_score || 0.5,
      memoryType: (mem.memory_type === 'explicit' ? 'explicit' : 'automatic') as 'explicit' | 'automatic',
      createdAt: mem.created_at || new Date().toISOString(),
      lastAccessedAt: mem.last_accessed_at,
    }))
  }

  return []
}

/**
 * Gather CRM data
 */
async function gatherCrmData(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ExportData['crmData']> {
  // Get connected providers from user_keys
  const { data: keys } = await supabase
    .from('user_keys')
    .select('provider')
    .eq('user_id', userId)
    .in('provider', ['bloomerang', 'virtuous', 'neoncrm', 'donorperfect', 'salesforce', 'blackbaud', 'everyaction'])

  const connectedProviders = keys?.map(k => k.provider) || []

  // Get last sync time
  const { data: lastSync } = await supabase
    .from('crm_sync_logs')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  // Get constituents
  const { data: constituents } = await supabase
    .from('crm_constituents')
    .select('provider, external_id, name, email, phone, address, total_giving, last_gift_date, last_gift_amount, created_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  // Get donations
  const { data: donations } = await supabase
    .from('crm_donations')
    .select('provider, amount, currency, date, type, fund, campaign, created_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  return {
    connectedProviders,
    constituents: (constituents || []).map(c => ({
      provider: c.provider,
      externalId: c.external_id,
      name: c.name || '',
      email: c.email,
      phone: c.phone,
      address: c.address,
      totalGiving: c.total_giving,
      lastGiftDate: c.last_gift_date,
      lastGiftAmount: c.last_gift_amount,
      createdAt: c.created_at || new Date().toISOString(),
    })),
    donations: (donations || []).map(d => ({
      provider: d.provider,
      amount: d.amount || 0,
      currency: d.currency || 'USD',
      date: d.date || new Date().toISOString(),
      type: d.type,
      fund: d.fund,
      campaign: d.campaign,
      createdAt: d.created_at || new Date().toISOString(),
    })),
    lastSyncAt: lastSync?.completed_at || null,
  }
}

/**
 * Estimate export size in bytes (rough estimate)
 */
export async function estimateExportSize(
  supabase: AnySupabaseClient,
  userId: string,
  options: ExportOptions
): Promise<number> {
  let estimatedSize = 1000 // Base JSON overhead

  const sections = options.sections.includes('all')
    ? ['profile', 'preferences', 'chats', 'memories', 'crm']
    : options.sections

  if (sections.includes('profile') || sections.includes('preferences')) {
    estimatedSize += 2000 // Profile and preferences are small
  }

  if (sections.includes('chats')) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Estimate ~500 bytes per message on average
    estimatedSize += (count || 0) * 500
  }

  if (sections.includes('memories')) {
    const { count } = await supabase
      .from('user_memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Estimate ~300 bytes per memory
    estimatedSize += (count || 0) * 300
  }

  if (sections.includes('crm')) {
    const { count: constCount } = await supabase
      .from('crm_constituents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: donCount } = await supabase
      .from('crm_donations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Estimate ~400 bytes per constituent, ~200 bytes per donation
    estimatedSize += (constCount || 0) * 400 + (donCount || 0) * 200
  }

  return estimatedSize
}
