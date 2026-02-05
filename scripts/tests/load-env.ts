import { readFileSync } from "fs"
import { resolve } from "path"

const DEFAULT_ENV_PATHS = [".env.local", ".vercel/.env.production.local"]

function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        let value = trimmed.slice(eqIndex + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  } catch {
    // Ignore if file doesn't exist
  }
}

export function loadEnvFiles(paths: string[] = DEFAULT_ENV_PATHS): void {
  for (const envPath of paths) {
    loadEnvFile(resolve(process.cwd(), envPath))
  }
}
