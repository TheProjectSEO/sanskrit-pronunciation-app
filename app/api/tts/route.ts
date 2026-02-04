import { NextRequest, NextResponse } from 'next/server';

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default Adam voice

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (!ELEVENLABS_API_KEY) {
      // Fallback to browser TTS if no API key
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured', fallback: true },
        { status: 400 }
      );
    }

    // Call ElevenLabs API - User's tested configuration
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.50,        // 50%
            similarity_boost: 1.0,  // 100%
            style: 0.0,             // 0% style exaggeration
            use_speaker_boost: true,
            speed: 0.88,            // Slightly slower
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: 'TTS generation failed', fallback: true },
        { status: 500 }
      );
    }

    // Return audio as blob
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json(
      { error: 'TTS generation failed', fallback: true },
      { status: 500 }
    );
  }
}
