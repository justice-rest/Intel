"use client"

import { cn } from "@/lib/utils"
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
} from "@/lib/pdf-branding"

interface PdfPreviewProps {
  primaryColor: string
  accentColor: string
  logoBase64: string | null
  hideDefaultFooter: boolean
  customFooterText: string | null
  className?: string
}

/**
 * Live PDF Preview Component
 * Shows a miniature preview of how the PDF will look with current branding settings
 */
export function PdfPreview({
  primaryColor,
  accentColor,
  logoBase64,
  hideDefaultFooter,
  customFooterText,
  className,
}: PdfPreviewProps) {
  // Use defaults if colors are empty
  const primary = primaryColor || DEFAULT_PRIMARY_COLOR
  const accent = accentColor || DEFAULT_ACCENT_COLOR

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white shadow-sm",
        className
      )}
      style={{
        aspectRatio: "8.5 / 11", // Letter paper ratio
      }}
    >
      {/* Paper content - scaled down */}
      <div className="absolute inset-0 flex flex-col p-3 text-[6px] leading-tight">
        {/* Header */}
        <div className="mb-2 border-b pb-2 text-center" style={{ borderColor: "#e2e8f0" }}>
          {/* Logo */}
          {logoBase64 ? (
            <img
              src={logoBase64}
              alt="Logo"
              className="mx-auto mb-1.5 h-4 w-auto object-contain"
            />
          ) : (
            <div
              className="mx-auto mb-1.5 flex h-4 w-12 items-center justify-center rounded text-[5px] font-medium"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              LOGO
            </div>
          )}
          {/* Date */}
          <div className="mb-0.5 text-[5px] font-medium text-gray-400">
            January 6, 2026
          </div>
          {/* Prospect Name */}
          <div
            className="text-[10px] font-bold tracking-tight"
            style={{ color: primary }}
          >
            Jane Smith
          </div>
          {/* Location */}
          <div className="text-[5px] font-medium text-gray-500">
            San Francisco, CA
          </div>
        </div>

        {/* Section: Executive Summary */}
        <div className="mb-2">
          <div
            className="mb-1 border-b-[1.5px] pb-0.5 text-[7px] font-bold"
            style={{ color: primary, borderColor: accent }}
          >
            Executive Summary
          </div>
          <div
            className="rounded p-1.5"
            style={{ backgroundColor: "#f8fafc" }}
          >
            <div className="h-1 w-full rounded bg-gray-200" />
            <div className="mt-0.5 h-1 w-4/5 rounded bg-gray-200" />
            <div className="mt-0.5 h-1 w-3/4 rounded bg-gray-200" />
          </div>
        </div>

        {/* Section: Personal Background */}
        <div className="mb-2">
          <div
            className="mb-1 border-b-[1.5px] pb-0.5 text-[7px] font-bold"
            style={{ color: primary, borderColor: accent }}
          >
            Personal Background
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded bg-gray-50 p-1">
              <div className="text-[4px] font-semibold uppercase tracking-wide text-gray-400">
                Name
              </div>
              <div className="text-[5px] font-medium" style={{ color: primary }}>
                Jane Smith
              </div>
            </div>
            <div className="rounded bg-gray-50 p-1">
              <div className="text-[4px] font-semibold uppercase tracking-wide text-gray-400">
                Location
              </div>
              <div className="text-[5px] font-medium" style={{ color: primary }}>
                San Francisco
              </div>
            </div>
          </div>
        </div>

        {/* Section: Giving Capacity (Callout) */}
        <div className="mb-2">
          <div
            className="mb-1 border-b-[1.5px] pb-0.5 text-[7px] font-bold"
            style={{ color: primary, borderColor: accent }}
          >
            Giving Capacity
          </div>
          <div
            className="rounded-md border p-1.5 text-center"
            style={{
              backgroundColor: "#f0f9ff",
              borderColor: "#bae6fd",
            }}
          >
            <div
              className="text-[4px] font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              Major Gift Capacity
            </div>
            <div
              className="text-[9px] font-bold"
              style={{ color: primary }}
            >
              $500K - $1M
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div
          className="mt-auto border-t pt-1.5 text-center"
          style={{ borderColor: "#e2e8f0" }}
        >
          {!hideDefaultFooter && (
            <>
              <div className="text-[4px] text-gray-400">
                This report contains confidential proprietary research...
              </div>
              <div className="mt-0.5 text-[4px] text-gray-400">
                Generated by Rōmy • intel.getromy.app
              </div>
            </>
          )}
          {customFooterText && (
            <div
              className={cn(
                "text-[4px] text-gray-400",
                !hideDefaultFooter && "mt-0.5"
              )}
            >
              {customFooterText.length > 50
                ? `${customFooterText.slice(0, 50)}...`
                : customFooterText}
            </div>
          )}
          {hideDefaultFooter && !customFooterText && (
            <div className="text-[4px] italic text-gray-300">
              (No footer)
            </div>
          )}
        </div>
      </div>

      {/* Preview label */}
      <div className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[6px] font-medium text-white">
        Preview
      </div>
    </div>
  )
}
