import { NextRequest, NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/speech"
const GROQ_MODEL = "canopylabs/orpheus-v1-english"

// Rate limiting: 20 requests per minute per IP (TTS is more expensive)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20

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

// Available English voices
type OrpheusVoice = "autumn" | "diana" | "hannah" | "austin" | "daniel" | "troy"

const VALID_VOICES: OrpheusVoice[] = ["autumn", "diana", "hannah", "austin", "daniel", "troy"]
const DEFAULT_VOICE: OrpheusVoice = "hannah"

// Max characters per request for Orpheus
const MAX_CHARS_PER_CHUNK = 200

// Split text into chunks at sentence boundaries
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]

  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()

    if (!trimmedSentence) continue

    // If a single sentence is too long, split by words
    if (trimmedSentence.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ""
      }

      const words = trimmedSentence.split(/\s+/)
      let wordChunk = ""

      for (const word of words) {
        if ((wordChunk + " " + word).trim().length > maxChars) {
          if (wordChunk) {
            chunks.push(wordChunk.trim())
          }
          wordChunk = word
        } else {
          wordChunk = (wordChunk + " " + word).trim()
        }
      }

      if (wordChunk) {
        currentChunk = wordChunk
      }
    } else if ((currentChunk + " " + trimmedSentence).trim().length > maxChars) {
      // Current chunk would exceed limit, push it and start new
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = trimmedSentence
    } else {
      // Add sentence to current chunk
      currentChunk = (currentChunk + " " + trimmedSentence).trim()
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

// Concatenate WAV files (simple header rewrite)
async function concatenateWavBuffers(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (buffers.length === 0) {
    throw new Error("No audio buffers to concatenate")
  }

  if (buffers.length === 1) {
    return buffers[0]
  }

  // For WAV files, we need to:
  // 1. Skip the 44-byte header on all but the first file
  // 2. Concatenate the audio data
  // 3. Update the file size in the header

  const HEADER_SIZE = 44
  let totalDataSize = 0
  const audioDataArrays: Uint8Array[] = []

  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i]
    const dataStart = i === 0 ? 0 : HEADER_SIZE
    const data = new Uint8Array(buffer).slice(dataStart)
    audioDataArrays.push(data)
    totalDataSize += i === 0 ? buffer.byteLength : buffer.byteLength - HEADER_SIZE
  }

  // Create the concatenated buffer
  const result = new Uint8Array(totalDataSize)
  let offset = 0

  for (const data of audioDataArrays) {
    result.set(data, offset)
    offset += data.length
  }

  // Update the RIFF chunk size (bytes 4-7) and data chunk size (bytes 40-43)
  const view = new DataView(result.buffer)
  view.setUint32(4, totalDataSize - 8, true) // RIFF chunk size
  view.setUint32(40, totalDataSize - HEADER_SIZE, true) // data chunk size

  return result.buffer
}

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

    const body = await request.json()
    const { text, voice: requestedVoice } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      )
    }

    // Strip markdown and clean text for TTS
    const cleanText = text
      .replace(/#{1,6}\s/g, "") // Remove markdown headers
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
      .replace(/\*([^*]+)\*/g, "$1") // Remove italics
      .replace(/`([^`]+)`/g, "$1") // Remove inline code
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
      .replace(/^[-*+]\s/gm, "") // Remove list markers
      .replace(/^\d+\.\s/gm, "") // Remove numbered list markers
      .replace(/\n{3,}/g, "\n\n") // Normalize newlines
      .trim()

    if (!cleanText) {
      return NextResponse.json(
        { error: "No speakable text content" },
        { status: 400 }
      )
    }

    // Validate and set voice
    const voice: OrpheusVoice = VALID_VOICES.includes(requestedVoice as OrpheusVoice)
      ? (requestedVoice as OrpheusVoice)
      : DEFAULT_VOICE

    // Split text into chunks
    const chunks = splitTextIntoChunks(cleanText, MAX_CHARS_PER_CHUNK)

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No text to synthesize" },
        { status: 400 }
      )
    }

    // Generate audio for each chunk
    const audioBuffers: ArrayBuffer[] = []

    for (const chunk of chunks) {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          input: chunk,
          voice: voice,
          response_format: "wav",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Groq TTS API error:", errorData)
        return NextResponse.json(
          { error: errorData.error?.message || "Text-to-speech synthesis failed" },
          { status: response.status }
        )
      }

      const audioBuffer = await response.arrayBuffer()
      audioBuffers.push(audioBuffer)
    }

    // Concatenate all audio chunks
    const finalAudio = await concatenateWavBuffers(audioBuffers)

    // Return the audio file
    return new NextResponse(finalAudio, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": finalAudio.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Text-to-speech error:", error)
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 }
    )
  }
}
