"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { cn } from "@/lib/utils"
import { CRM_PROVIDERS } from "@/lib/crm/config"
import type { CRMProvider, CRMIntegrationStatus } from "@/lib/crm/types"
import { KeyIcon, PlusIcon, ArrowSquareOut } from "@phosphor-icons/react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2, RefreshCw } from "lucide-react"
import { GoogleIntegrationSection } from "./google-section"

export function IntegrationsSection() {
  const queryClient = useQueryClient()
  const [selectedProvider, setSelectedProvider] = useState<CRMProvider>("bloomerang")
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [secondaryKeys, setSecondaryKeys] = useState<Record<string, string>>({}) // For providers with two credentials (e.g., Neon CRM Org ID)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<CRMProvider | "">("")

  // Fetch integration statuses
  const { data: integrations } = useQuery({
    queryKey: ["crm-integrations"],
    queryFn: async () => {
      const res = await fetchClient("/api/crm-integrations")
      if (!res.ok) throw new Error("Failed to fetch integrations")
      const data = await res.json()
      return data.integrations as CRMIntegrationStatus[]
    },
  })

  // Create a map of provider -> connection status
  const connectionStatus: Record<CRMProvider, boolean> = {
    bloomerang: integrations?.find((i) => i.provider === "bloomerang")?.connected || false,
    virtuous: integrations?.find((i) => i.provider === "virtuous")?.connected || false,
    neoncrm: integrations?.find((i) => i.provider === "neoncrm")?.connected || false,
    donorperfect: integrations?.find((i) => i.provider === "donorperfect")?.connected || false,
  }

  const getIntegrationInfo = (provider: CRMProvider) => {
    return integrations?.find((i) => i.provider === provider)
  }

  const selectedProviderConfig = CRM_PROVIDERS.find((p) => p.id === selectedProvider)

  const getProviderValue = (providerId: CRMProvider) => {
    const provider = CRM_PROVIDERS.find((p) => p.id === providerId)
    if (!provider) return ""

    const hasKey = connectionStatus[providerId]
    const fallbackValue = hasKey ? "••••••••••••••••" : ""
    return apiKeys[providerId] || fallbackValue
  }

  const getSecondaryValue = (providerId: CRMProvider) => {
    const hasKey = connectionStatus[providerId]
    const fallbackValue = hasKey ? "••••••••••••••••" : ""
    return secondaryKeys[providerId] || fallbackValue
  }

  // Save API key mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      provider,
      apiKey,
      secondaryKey,
    }: {
      provider: CRMProvider
      apiKey: string
      secondaryKey?: string
    }) => {
      const res = await fetchClient("/api/crm-integrations", {
        method: "POST",
        body: JSON.stringify({ provider, apiKey, secondaryKey }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to save key")
      }
      return res.json()
    },
    onSuccess: async (response, { provider }) => {
      toast({
        title: response.isNewKey ? "CRM Connected" : "API Key Updated",
        description: response.message,
      })

      // Refresh integrations list
      await queryClient.invalidateQueries({ queryKey: ["crm-integrations"] })

      // Clear the inputs
      setApiKeys((prev) => ({
        ...prev,
        [provider]: "",
      }))
      setSecondaryKeys((prev) => ({
        ...prev,
        [provider]: "",
      }))
    },
    onError: (error, { provider }) => {
      toast({
        title: "Failed to connect",
        description: error instanceof Error ? error.message : `Failed to save ${CRM_PROVIDERS.find((p) => p.id === provider)?.name || provider} API key.`,
      })
    },
  })

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: async (provider: CRMProvider) => {
      const res = await fetchClient(`/api/crm-integrations/${provider}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      return res.json()
    },
    onSuccess: async (response, provider) => {
      toast({
        title: "CRM Disconnected",
        description: response.message,
      })
      await queryClient.invalidateQueries({ queryKey: ["crm-integrations"] })
      setApiKeys((prev) => ({ ...prev, [provider]: "" }))
      setDeleteDialogOpen(false)
      setProviderToDelete("")
    },
    onError: (_error, provider) => {
      toast({
        title: "Failed to disconnect",
        description: `Failed to disconnect ${CRM_PROVIDERS.find((p) => p.id === provider)?.name || provider}. Please try again.`,
      })
      setDeleteDialogOpen(false)
      setProviderToDelete("")
    },
  })

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (provider: CRMProvider) => {
      const res = await fetchClient(`/api/crm-integrations/${provider}/sync`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to start sync")
      }
      return res.json()
    },
    onSuccess: async (response) => {
      toast({
        title: "Sync Started",
        description: response.message,
      })
      // Start polling for sync status
      queryClient.invalidateQueries({ queryKey: ["crm-integrations"] })
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to start sync",
      })
    },
  })

  const handleConfirmDelete = () => {
    if (providerToDelete) {
      deleteMutation.mutate(providerToDelete as CRMProvider)
    }
  }

  const handleDeleteClick = (providerId: CRMProvider) => {
    setProviderToDelete(providerId)
    setDeleteDialogOpen(true)
  }

  const handleSave = (providerId: CRMProvider) => {
    const providerConfig = CRM_PROVIDERS.find((p) => p.id === providerId)
    const value = apiKeys[providerId]
    const secondaryValue = secondaryKeys[providerId]

    if (!value || value === "••••••••••••••••") {
      toast({
        title: "API Key Required",
        description: "Please enter your API key.",
      })
      return
    }

    // Check for secondary key if provider requires it
    if (providerConfig?.secondaryPlaceholder && (!secondaryValue || secondaryValue === "••••••••••••••••")) {
      toast({
        title: `${providerConfig.secondaryLabel || "Secondary Key"} Required`,
        description: `Please enter your ${providerConfig.secondaryLabel || "secondary credential"}.`,
      })
      return
    }

    saveMutation.mutate({
      provider: providerId,
      apiKey: value,
      secondaryKey: providerConfig?.secondaryPlaceholder ? secondaryValue : undefined,
    })
  }

  const handleSync = (providerId: CRMProvider) => {
    syncMutation.mutate(providerId)
  }

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div>
      <h3 className="relative mb-2 flex items-center gap-2 text-lg font-medium">
        CRM Integrations
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
          BETA
        </span>
      </h3>
      <p className="text-muted-foreground text-sm">
        Connect your CRM to sync constituent and donation data for prospect research.
      </p>
      <p className="text-muted-foreground text-sm">
        Your API keys are stored securely with end-to-end encryption.{" "}
        <Link
          href="/docs"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          target="_blank"
        >
          Setup guide
          <ArrowSquareOut className="h-3 w-3" />
        </Link>
      </p>

      {/* Provider Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 min-[400px]:grid-cols-3">
        {CRM_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setSelectedProvider(provider.id)}
            className={cn(
              "relative flex aspect-square min-w-28 flex-col items-center justify-center gap-2 rounded-lg border p-4",
              selectedProvider === provider.id
                ? "border-primary ring-primary/30 ring-2"
                : "border-border"
            )}
          >
            {connectionStatus[provider.id] && (
              <span className="bg-secondary absolute top-1 right-1 rounded-sm border-[1px] p-1">
                <KeyIcon className="text-secondary-foreground size-3.5" />
              </span>
            )}
            {provider.beta && (
              <span className="absolute top-1 left-1 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                BETA
              </span>
            )}
            <provider.icon className="size-6" />
            <span className="text-sm">{provider.name}</span>
          </button>
        ))}
        {/* Coming soon placeholder */}
        <button
          type="button"
          disabled
          className={cn(
            "flex aspect-square min-w-28 flex-col items-center justify-center gap-2 rounded-lg border p-4 opacity-20",
            "border-primary border-dashed"
          )}
        >
          <PlusIcon className="size-6" />
          <span className="text-xs">Coming Soon</span>
        </button>
      </div>

      {/* Selected Provider Details */}
      <div className="mt-4">
        {selectedProviderConfig && (
          <div className="flex flex-col">
            <p className="text-muted-foreground text-xs mb-3">
              {selectedProviderConfig.description}
            </p>
            {/* Secondary credential field (e.g., Neon CRM Org ID) - shown first for providers that need it */}
            {selectedProviderConfig.secondaryPlaceholder && (
              <>
                <Label htmlFor={`${selectedProvider}-secondary`} className="mb-2">
                  {selectedProviderConfig.secondaryLabel || "Secondary Credential"}
                </Label>
                <Input
                  id={`${selectedProvider}-secondary`}
                  type="text"
                  placeholder={selectedProviderConfig.secondaryPlaceholder}
                  value={getSecondaryValue(selectedProvider)}
                  onChange={(e) =>
                    setSecondaryKeys((prev) => ({
                      ...prev,
                      [selectedProvider]: e.target.value,
                    }))
                  }
                  disabled={saveMutation.isPending}
                  className="mb-3"
                />
              </>
            )}

            <Label htmlFor={`${selectedProvider}-key`} className="mb-2">
              {selectedProviderConfig.name} API Key
            </Label>
            <Input
              id={`${selectedProvider}-key`}
              type="password"
              placeholder={selectedProviderConfig.placeholder}
              value={getProviderValue(selectedProvider)}
              onChange={(e) =>
                setApiKeys((prev) => ({
                  ...prev,
                  [selectedProvider]: e.target.value,
                }))
              }
              disabled={saveMutation.isPending}
            />

            {/* Integration Status */}
            {connectionStatus[selectedProvider] && (
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Records: {getIntegrationInfo(selectedProvider)?.recordCount?.toLocaleString() || 0}
                </span>
                <span>
                  Last sync: {formatLastSync(getIntegrationInfo(selectedProvider)?.lastSync)}
                </span>
              </div>
            )}

            <div className="mt-2 flex justify-between pl-1">
              <a
                href={selectedProviderConfig.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground mt-1 text-xs hover:underline"
              >
                Get API key
              </a>
              <div className="flex gap-2">
                {connectionStatus[selectedProvider] && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(selectedProvider)}
                      disabled={syncMutation.isPending || saveMutation.isPending || deleteMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 size-4" />
                      )}
                      Sync
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick(selectedProvider)}
                      disabled={deleteMutation.isPending || saveMutation.isPending}
                    >
                      <Trash2 className="mr-1 size-4" />
                      Disconnect
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => handleSave(selectedProvider)}
                  type="button"
                  size="sm"
                  disabled={saveMutation.isPending || deleteMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : connectionStatus[selectedProvider] ? (
                    "Update"
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect CRM</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect{" "}
              {CRM_PROVIDERS.find((p) => p.id === providerToDelete)?.name}?
              This will remove your API key and all synced data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Google Workspace Section */}
      <div className="mt-8 border-t pt-8">
        <GoogleIntegrationSection />
      </div>
    </div>
  )
}
