import { NextRequest, NextResponse } from "next/server"

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/speech"
const GROQ_MODEL = "canopylabs/orpheus-v1-english"

// Rate limiting: 5 requests per minute per IP (conservative to avoid Groq limits)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5

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

// Orpheus supports up to ~4000 characters per request
// Using 3500 to be safe and allow for sentence boundary adjustments
const MAX_CHARS_PER_CHUNK = 3500

// Groq free tier: 10 RPM for Orpheus
// We add delays between chunks to stay under limit
const DELAY_BETWEEN_CHUNKS_MS = 7000 // 7 seconds = ~8.5 requests/min max

// Split text into chunks at sentence/paragraph boundaries
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  // If text fits in one chunk, return it directly
  if (text.length <= maxChars) {
    return [text]
  }

  const chunks: string[] = []

  // First try to split by paragraphs
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ""

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    // If adding this paragraph exceeds limit, handle it
    if ((currentChunk + "\n\n" + trimmedParagraph).length > maxChars) {
      // Save current chunk if not empty
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ""
      }

      // If single paragraph is too long, split by sentences
      if (trimmedParagraph.length > maxChars) {
        const sentences = trimmedParagraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmedParagraph]

        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim()
          if (!trimmedSentence) continue

          if ((currentChunk + " " + trimmedSentence).length > maxChars) {
            if (currentChunk) {
              chunks.push(currentChunk.trim())
            }

            // If single sentence is still too long, split by words
            if (trimmedSentence.length > maxChars) {
              const words = trimmedSentence.split(/\s+/)
              currentChunk = ""

              for (const word of words) {
                if ((currentChunk + " " + word).length > maxChars) {
                  if (currentChunk) chunks.push(currentChunk.trim())
                  currentChunk = word
                } else {
                  currentChunk = currentChunk ? currentChunk + " " + word : word
                }
              }
            } else {
              currentChunk = trimmedSentence
            }
          } else {
            currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence
          }
        }
      } else {
        currentChunk = trimmedParagraph
      }
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmedParagraph : trimmedParagraph
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

// Fetch with retry and exponential backoff for rate limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)

    if (response.ok) {
      return response
    }

    // Check if rate limited
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const retryAfter = parseInt(response.headers.get("retry-after") || "0", 10)
      const waitTime = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000

      console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      lastError = new Error(errorData.error?.message || "Rate limit exceeded")
    } else {
      // Non-retryable error
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

// Proper WAV concatenation with validation
function concatenateWavBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 0) {
    throw new Error("No audio buffers to concatenate")
  }

  if (buffers.length === 1) {
    return buffers[0]
  }

  // Validate first buffer is a valid WAV
  const firstBuffer = new Uint8Array(buffers[0])
  if (firstBuffer.length < 44) {
    throw new Error("Invalid WAV: buffer too small")
  }

  // Check RIFF header
  const riff = String.fromCharCode(firstBuffer[0], firstBuffer[1], firstBuffer[2], firstBuffer[3])
  const wave = String.fromCharCode(firstBuffer[8], firstBuffer[9], firstBuffer[10], firstBuffer[11])
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Invalid WAV: missing RIFF/WAVE header")
  }

  const HEADER_SIZE = 44

  // Calculate total audio data size (excluding headers from subsequent files)
  let totalAudioDataSize = 0
  for (let i = 0; i < buffers.length; i++) {
    const bufferSize = buffers[i].byteLength
    if (bufferSize < HEADER_SIZE) {
      throw new Error(`Invalid WAV chunk ${i}: too small`)
    }
    totalAudioDataSize += bufferSize - (i === 0 ? 0 : HEADER_SIZE)
  }

  // Create result buffer
  const result = new Uint8Array(totalAudioDataSize)
  let offset = 0

  // Copy first buffer entirely (includes header)
  const first = new Uint8Array(buffers[0])
  result.set(first, 0)
  offset = first.length

  // Copy remaining buffers without headers
  for (let i = 1; i < buffers.length; i++) {
    const data = new Uint8Array(buffers[i]).slice(HEADER_SIZE)
    result.set(data, offset)
    offset += data.length
  }

  // Update RIFF chunk size (bytes 4-7): total file size - 8
  const view = new DataView(result.buffer)
  view.setUint32(4, totalAudioDataSize - 8, true)

  // Update data chunk size (bytes 40-43): total audio data size
  view.setUint32(40, totalAudioDataSize - HEADER_SIZE, true)

  return result.buffer
}

// Clean text for TTS - remove markdown and normalize
function cleanTextForTTS(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "") // Remove markdown headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^*]+)\*/g, "$1") // Remove italics
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks entirely
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
    .replace(/^[-*+]\s/gm, "") // Remove list markers
    .replace(/^\d+\.\s/gm, "") // Remove numbered list markers
    .replace(/\|[^|]+\|/g, "") // Remove table content
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
    .replace(/\s{2,}/g, " ") // Normalize multiple spaces
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request)
    const { allowed, remaining } = checkRateLimit(clientIP)

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a minute." },
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

    // Clean and prepare text
    const cleanText = cleanTextForTTS(text)

    if (!cleanText || cleanText.length < 2) {
      return NextResponse.json(
        { error: "No speakable text content" },
        { status: 400 }
      )
    }

    // Limit total text length to avoid excessive API calls
    const MAX_TOTAL_LENGTH = 10000 // ~3 chunks max
    const truncatedText = cleanText.length > MAX_TOTAL_LENGTH
      ? cleanText.slice(0, MAX_TOTAL_LENGTH) + "..."
      : cleanText

    // Validate and set voice
    const voice: OrpheusVoice = VALID_VOICES.includes(requestedVoice as OrpheusVoice)
      ? (requestedVoice as OrpheusVoice)
      : DEFAULT_VOICE

    // Split text into chunks
    const chunks = splitTextIntoChunks(truncatedText, MAX_CHARS_PER_CHUNK)

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No text to synthesize" },
        { status: 400 }
      )
    }

    console.log(`TTS: Processing ${chunks.length} chunk(s), total ${truncatedText.length} chars`)

    // Generate audio for each chunk with rate limit awareness
    const audioBuffers: ArrayBuffer[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Add delay between chunks to avoid rate limiting (except for first chunk)
      if (i > 0) {
        console.log(`TTS: Waiting ${DELAY_BETWEEN_CHUNKS_MS}ms before chunk ${i + 1}/${chunks.length}`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS))
      }

      try {
        const response = await fetchWithRetry(
          GROQ_API_URL,
          {
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
          },
          3 // max retries
        )

        const audioBuffer = await response.arrayBuffer()

        // Validate we got actual audio data
        if (audioBuffer.byteLength < 100) {
          throw new Error("Received empty or invalid audio response")
        }

        audioBuffers.push(audioBuffer)
      } catch (error) {
        console.error(`TTS chunk ${i + 1} failed:`, error)

        // If we have some audio, return what we have
        if (audioBuffers.length > 0) {
          console.log(`TTS: Returning partial audio (${audioBuffers.length}/${chunks.length} chunks)`)
          break
        }

        // No audio at all, throw error
        throw error
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate audio" },
        { status: 500 }
      )
    }

    // Concatenate all audio chunks
    const finalAudio = concatenateWavBuffers(audioBuffers)

    // Return the audio file
    return new NextResponse(finalAudio, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": finalAudio.byteLength.toString(),
        "Cache-Control": "private, max-age=3600", // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error("Text-to-speech error:", error)
    const message = error instanceof Error ? error.message : "Failed to synthesize speech"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
