"use client"

import { useState, useCallback, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCustomer } from "autumn-js/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  CaretDown,
  FileText,
  Lock,
  Spinner,
  ArrowCounterClockwise,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { fetchClient } from "@/lib/fetch"
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
  MAX_FOOTER_TEXT_LENGTH,
  type PdfBrandingApiResponse,
} from "@/lib/pdf-branding"
import { ColorPicker } from "./color-picker"
import { LogoUpload } from "./logo-upload"
import { PdfPreview } from "./pdf-preview"

// ============================================================================
// Main Component
// ============================================================================

export function PdfBrandingSettings() {
  const queryClient = useQueryClient()
  const { customer } = useCustomer()
  const [isOpen, setIsOpen] = useState(false)

  // Check Pro/Scale plan status
  const activeProduct = customer?.products?.find(
    (p: { status: string }) => p.status === "active" || p.status === "trialing"
  )
  const planId = activeProduct?.id?.toLowerCase() || ""
  const isPro = planId.includes("pro")
  const isScale = planId.includes("scale")
  const hasPaidPlan = isPro || isScale

  // Local form state
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR)
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR)
  const [hideDefaultFooter, setHideDefaultFooter] = useState(false)
  const [customFooterText, setCustomFooterText] = useState("")
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch branding settings
  const { data: branding, isLoading } = useQuery({
    queryKey: ["pdf-branding"],
    queryFn: async () => {
      const res = await fetchClient("/api/pdf-branding")
      if (!res.ok) throw new Error("Failed to fetch branding")
      return res.json() as Promise<PdfBrandingApiResponse>
    },
    enabled: hasPaidPlan,
  })

  // Sync form state with fetched data
  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primary_color || DEFAULT_PRIMARY_COLOR)
      setAccentColor(branding.accent_color || DEFAULT_ACCENT_COLOR)
      setHideDefaultFooter(branding.hide_default_footer || false)
      setCustomFooterText(branding.custom_footer_text || "")
      setHasChanges(false)
    }
  }, [branding])

  // Track changes
  useEffect(() => {
    if (!branding) return

    const changed =
      primaryColor !== (branding.primary_color || DEFAULT_PRIMARY_COLOR) ||
      accentColor !== (branding.accent_color || DEFAULT_ACCENT_COLOR) ||
      hideDefaultFooter !== (branding.hide_default_footer || false) ||
      customFooterText !== (branding.custom_footer_text || "")

    setHasChanges(changed)
  }, [branding, primaryColor, accentColor, hideDefaultFooter, customFooterText])

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/pdf-branding", {
        method: "PUT",
        body: JSON.stringify({
          primary_color: primaryColor,
          accent_color: accentColor,
          hide_default_footer: hideDefaultFooter,
          custom_footer_text: customFooterText || null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Branding settings saved")
      queryClient.invalidateQueries({ queryKey: ["pdf-branding"] })
      setHasChanges(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    },
  })

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)

      // Get CSRF token
      const csrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("csrf_token="))
        ?.split("=")[1]

      const res = await fetch("/api/pdf-branding/logo", {
        method: "POST",
        headers: {
          "x-csrf-token": csrf || "",
        },
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Upload failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Logo uploaded")
      queryClient.invalidateQueries({ queryKey: ["pdf-branding"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload logo")
    },
  })

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/pdf-branding/logo", {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Delete failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Logo removed")
      queryClient.invalidateQueries({ queryKey: ["pdf-branding"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove logo")
    },
  })

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/pdf-branding/reset", {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Reset failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Branding reset to defaults")
      queryClient.invalidateQueries({ queryKey: ["pdf-branding"] })
      // Reset local state
      setPrimaryColor(DEFAULT_PRIMARY_COLOR)
      setAccentColor(DEFAULT_ACCENT_COLOR)
      setHideDefaultFooter(false)
      setCustomFooterText("")
      setHasChanges(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to reset")
    },
  })

  // Handlers
  const handleLogoUpload = useCallback(
    async (file: File) => {
      await uploadLogoMutation.mutateAsync(file)
    },
    [uploadLogoMutation]
  )

  const handleLogoDelete = useCallback(async () => {
    await deleteLogoMutation.mutateAsync()
  }, [deleteLogoMutation])

  const handleSave = useCallback(() => {
    saveMutation.mutate()
  }, [saveMutation])

  const handleReset = useCallback(() => {
    resetMutation.mutate()
  }, [resetMutation])

  const isSaving =
    saveMutation.isPending ||
    uploadLogoMutation.isPending ||
    deleteLogoMutation.isPending ||
    resetMutation.isPending

  // Check if any settings have been customized
  const hasCustomizations =
    branding &&
    (branding.primary_color !== DEFAULT_PRIMARY_COLOR ||
      branding.accent_color !== DEFAULT_ACCENT_COLOR ||
      branding.logo_url ||
      branding.hide_default_footer ||
      branding.custom_footer_text)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors",
            isOpen
              ? "border-border bg-muted/50"
              : "border-border/50 hover:border-border hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-3">
            <FileText className="text-muted-foreground size-5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Report Branding</h3>
                {!hasPaidPlan && (
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                    Pro
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Customize colors, logo, and footer for PDF reports
              </p>
            </div>
          </div>
          <CaretDown
            className={cn(
              "text-muted-foreground size-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4">
        {!hasPaidPlan ? (
          // Locked state for non-Pro users
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
            <Lock className="text-muted-foreground mb-3 size-8" />
            <h4 className="mb-1 text-sm font-medium">Pro Feature</h4>
            <p className="text-muted-foreground mb-4 max-w-xs text-xs">
              Customize your PDF reports with your own branding. Upgrade to Pro
              or Scale to unlock this feature.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/pricing">View Plans</a>
            </Button>
          </div>
        ) : isLoading ? (
          // Loading state
          <div className="flex items-center justify-center p-8">
            <Spinner className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : (
          // Branding settings form with live preview
          <div className="flex gap-6">
            {/* Settings Panel */}
            <div className="flex-1 space-y-6">
              {/* Colors Section */}
              <div className="space-y-4">
                <ColorPicker
                  label="Primary Color"
                  description="Used for headers and main text"
                  value={primaryColor}
                  defaultValue={DEFAULT_PRIMARY_COLOR}
                  onChange={setPrimaryColor}
                  disabled={isSaving}
                />

                <ColorPicker
                  label="Accent Color"
                  description="Used for highlights and section borders"
                  value={accentColor}
                  defaultValue={DEFAULT_ACCENT_COLOR}
                  onChange={setAccentColor}
                  disabled={isSaving}
                />
              </div>

              {/* Logo Section */}
              <div className="border-t pt-4">
                <LogoUpload
                  logoUrl={branding?.logo_url || null}
                  logoBase64={branding?.logo_base64 || null}
                  onUpload={handleLogoUpload}
                  onDelete={handleLogoDelete}
                  disabled={isSaving}
                />
              </div>

              {/* Footer Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      Hide Romy branding
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Remove &quot;Generated by Romy&quot; from PDF footer
                    </p>
                  </div>
                  <Switch
                    checked={hideDefaultFooter}
                    onCheckedChange={setHideDefaultFooter}
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Custom footer text</Label>
                  <p className="text-muted-foreground text-xs">
                    Add your own footer text (e.g., &quot;Prepared by Acme
                    Foundation&quot;)
                  </p>
                  <Input
                    value={customFooterText}
                    onChange={(e) => setCustomFooterText(e.target.value)}
                    placeholder="Enter custom footer text..."
                    maxLength={MAX_FOOTER_TEXT_LENGTH}
                    disabled={isSaving}
                  />
                  <p className="text-muted-foreground text-right text-xs">
                    {customFooterText.length}/{MAX_FOOTER_TEXT_LENGTH}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={isSaving || !hasCustomizations}
                  className="text-muted-foreground"
                >
                  <ArrowCounterClockwise className="mr-1 size-4" />
                  Reset to defaults
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  size="sm"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Spinner className="mr-1 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>

            {/* Live Preview Panel */}
            <div className="hidden w-48 shrink-0 lg:block">
              <div className="sticky top-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Live Preview
                </p>
                <PdfPreview
                  primaryColor={primaryColor}
                  accentColor={accentColor}
                  logoBase64={
                    uploadLogoMutation.isPending
                      ? null
                      : branding?.logo_base64 || null
                  }
                  hideDefaultFooter={hideDefaultFooter}
                  customFooterText={customFooterText || null}
                />
              </div>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
