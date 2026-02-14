import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam voice

export async function POST(request: NextRequest) {
  try {
    const { mantra_id, text_roman } = await request.json();

    if (!mantra_id || !text_roman) {
      return NextResponse.json(
        { error: 'mantra_id and text_roman are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Split text into words (preserve Devanagari and Sanskrit)
    const words = text_roman
      .split(/\s+/)
      .filter((w) => w.trim().length > 0)
      .map((w) => w.trim());

    const wordAudioMap: Record<string, string> = {};
    const processedWords: Array<{ word: string; position: number; audio_url: string }> = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Check if audio already exists in cache
      const { data: cached } = await supabase
        .from('word_audio_cache')
        .select('id, audio_url')
        .eq('word', word)
        .eq('tts_provider', 'elevenlabs')
        .eq('tts_model', 'eleven_multilingual_v2')
        .eq('language', 'sa')
        .single();

      let audioUrl: string;
      let wordAudioId: string;

      if (cached) {
        // Use cached audio
        audioUrl = cached.audio_url;
        wordAudioId = cached.id;
        console.log(`Using cached audio for word: ${word}`);
      } else {
        // Generate new TTS audio
        console.log(`Generating TTS for word: ${word}`);
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: word,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          }
        );

        if (!ttsResponse.ok) {
          console.error(`TTS failed for word: ${word}`);
          continue;
        }

        const audioBlob = await ttsResponse.blob();
        const audioBuffer = await audioBlob.arrayBuffer();

        // Upload to Supabase Storage
        const fileName = `word-audio/${Date.now()}-${word.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('mantra-audio')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error(`Upload failed for word: ${word}`, uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('mantra-audio')
          .getPublicUrl(uploadData.path);

        audioUrl = urlData.publicUrl;

        // Save to cache
        const { data: cacheData, error: cacheError } = await supabase
          .from('word_audio_cache')
          .insert({
            word,
            audio_url: audioUrl,
            tts_provider: 'elevenlabs',
            tts_model: 'eleven_multilingual_v2',
            language: 'sa',
          })
          .select('id')
          .single();

        if (cacheError) {
          console.error(`Cache insert failed for word: ${word}`, cacheError);
          continue;
        }

        wordAudioId = cacheData.id;
      }

      // Link to mantra
      await supabase.from('mantra_word_audio').upsert(
        {
          mantra_id,
          word,
          word_audio_id: wordAudioId,
          word_position: i,
        },
        {
          onConflict: 'mantra_id,word_position',
        }
      );

      wordAudioMap[word] = audioUrl;
      processedWords.push({ word, position: i, audio_url: audioUrl });
    }

    return NextResponse.json({
      success: true,
      mantra_id,
      total_words: words.length,
      processed_words: processedWords.length,
      word_audio_map: wordAudioMap,
      words: processedWords,
    });
  } catch (error) {
    console.error('Word audio generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
