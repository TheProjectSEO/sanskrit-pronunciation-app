import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    process.env[key] = process.env[key] || value;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const mantraId = '695a0e94-906b-4551-9ba4-3a26a93118e6'; // Gayatri Mantra

  // Replicate the exact query from the word-audio API
  const { data: wordAudio, error } = await supabase
    .from('mantra_word_audio')
    .select('word, word_position, start_time, end_time, word_audio_cache(audio_url)')
    .eq('mantra_id', mantraId)
    .order('word_position', { ascending: true });

  if (error) {
    console.error('QUERY ERROR:', JSON.stringify(error, null, 2));
    return;
  }

  console.log('Total rows:', wordAudio?.length);
  if (wordAudio && wordAudio.length > 0) {
    console.log('First row:', JSON.stringify(wordAudio[0], null, 2));
    console.log('Last row:', JSON.stringify(wordAudio[wordAudio.length - 1], null, 2));
  }

  // Build timestamps the same way the API does
  const wordTimestamps: Record<string, { start: number; end: number }> = {};
  const wordAudioMap: Record<string, string> = {};

  (wordAudio || []).forEach((item: any) => {
    if (item.start_time != null && item.end_time != null) {
      wordTimestamps[item.word] = { start: item.start_time, end: item.end_time };
    }
    if (item.word_audio_cache?.audio_url) {
      wordAudioMap[item.word] = item.word_audio_cache.audio_url;
    }
  });

  console.log('\nTimestamps count:', Object.keys(wordTimestamps).length);
  console.log('Legacy audio map count:', Object.keys(wordAudioMap).length);
  console.log('\nTimestamps:', JSON.stringify(wordTimestamps, null, 2));

  // Also fetch reference audio URL
  const { data: mantra } = await supabase
    .from('mantras')
    .select('reference_audio_url, audio_url')
    .eq('id', mantraId)
    .single();

  console.log('\nReference audio URL:', mantra?.reference_audio_url || mantra?.audio_url || 'NONE');
}

test().catch(console.error);
