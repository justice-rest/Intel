import type { NextConfig } from "next"
import type { Configuration } from "webpack"

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

// Workflow DevKit integration for durable, resumable workflows
// See: https://useworkflow.dev
const { withWorkflow } = require("workflow/next")

const baseConfig: NextConfig = withBundleAnalyzer({
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  serverExternalPackages: [
    "shiki",
    "vscode-oniguruma",
    // PDF parsing dependencies - must be externalized for Node.js
    "unpdf",
    "canvas",
    "@napi-rs/canvas",
    "pdfjs-dist",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
        port: "",
        pathname: "/s2/favicons/**",
      },
    ],
  },
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Externalize unpdf and its native dependencies for server-side
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          "unpdf": "commonjs unpdf",
          "canvas": "commonjs canvas",
          "@napi-rs/canvas": "commonjs @napi-rs/canvas",
          "pdfjs-dist": "commonjs pdfjs-dist",
        })
      }
    }
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ]
    return config
  },
})

// Wrap with workflow plugin for durable workflow support
// This enables "use workflow" and "use step" directives
const nextConfig = withWorkflow(baseConfig, {
  workflows: {
    local: {
      // Use local workflow engine in development
      // In production, workflows run on Vercel or Postgres World
    },
  },
})

export default nextConfig
