import { NextResponse } from "next/server"

/**
 * GET /api/voice-features
 * Returns availability status of voice features (STT/TTS)
 * This allows the frontend to hide voice buttons when Groq API key isn't configured
 */
export async function GET() {
  const groqApiKey = process.env.GROQ_API_KEY

  return NextResponse.json({
    available: !!groqApiKey,
    features: {
      speechToText: !!groqApiKey,
      textToSpeech: !!groqApiKey,
    },
  })
}
