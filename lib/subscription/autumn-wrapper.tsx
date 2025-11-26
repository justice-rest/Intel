"use client"

import { AutumnProvider } from "autumn-js/react"

/**
 * Autumn Wrapper Component
 *
 * Wraps the application with Autumn's subscription provider.
 * This enables:
 * - useCustomer() hook for accessing subscription data
 * - Checkout flows for upgrading/downgrading
 * - Feature access checks
 * - Usage tracking
 *
 * The backendUrl is empty string because we're using a Next.js fullstack setup
 * with the Autumn handler at /api/autumn/*
 */
export function AutumnWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AutumnProvider backendUrl="" includeCredentials={true}>
      {children}
    </AutumnProvider>
  )
}
