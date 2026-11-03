/** One ElevenLabs text-to-speech call with the app's voice; returns MP3 bytes. */
export async function synthesize(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  if (!key) throw new Error('ElevenLabs is not configured');
  const voice = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_v4',
      voice_settings: { stability: 0.5, similarity_boost: 1.0, style: 0.0, use_speaker_boost: true, speed: 0.85 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
