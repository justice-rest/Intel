import OpenRouter from "@/components/icons/openrouter"
import Xai from "@/components/icons/xai"

export type Provider = {
  id: string
  name: string
  available: boolean
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: OpenRouter,
  },
  {
    id: "xai",
    name: "XAI",
    icon: Xai,
  },
] as Provider[]
