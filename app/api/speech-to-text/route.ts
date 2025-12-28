import { NextRequest, NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
const GROQ_MODEL = "whisper-large-v3-turbo"

// Rate limiting: 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 }
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  return forwarded?.split(",")[0]?.trim() || realIP || "unknown"
}

// Supported audio formats by Groq Whisper
const SUPPORTED_MIME_TYPES = [
  "audio/flac",
  "audio/mp3",
  "audio/mpeg",
  "audio/mpga",
  "audio/m4a",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
]

// Max file size: 25MB for free tier
const MAX_FILE_SIZE = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    const { allowed, remaining } = checkRateLimit(clientIP)

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
        }
      )
    }

    const groqApiKey = process.env.GROQ_API_KEY

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "Voice features not configured" },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      )
    }

    // Validate file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Audio file exceeds maximum size of 25MB" },
        { status: 400 }
      )
    }

    // Validate MIME type
    const mimeType = audioFile.type
    if (!SUPPORTED_MIME_TYPES.some((type) => mimeType.startsWith(type.split("/")[0]))) {
      return NextResponse.json(
        {
          error: `Unsupported audio format: ${mimeType}. Supported formats: FLAC, MP3, MP4, MPEG, M4A, OGG, WAV, WebM`,
        },
        { status: 400 }
      )
    }

    // Prepare form data for Groq API
    const groqFormData = new FormData()
    groqFormData.append("file", audioFile)
    groqFormData.append("model", GROQ_MODEL)
    groqFormData.append("language", "en")
    groqFormData.append("response_format", "json")

    // Call Groq Whisper API
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Groq Whisper API error:", errorData)
      return NextResponse.json(
        { error: errorData.error?.message || "Transcription failed" },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      text: result.text,
      duration: result.duration,
    })
  } catch (error) {
    console.error("Speech-to-text error:", error)
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    )
  }
}
