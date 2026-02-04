import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// Load .env.local manually (sync)
const envContent = fsSync.readFileSync('.env.local', 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = envVars.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function transcribeAudio(audioBuffer: Buffer, filename: string) {
  const uint8Array = new Uint8Array(audioBuffer);
  const file = new File([uint8Array], filename, {
    type: filename.endsWith('.m4a') ? 'audio/mp4' : 'audio/wav',
  });

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    prompt: 'Sanskrit mantra shloka. Om Namah Shivaya. Hare Krishna. Gayatri mantra. Transcribe accurately preserving Sanskrit pronunciation.',
  });

  return transcription.text;
}

async function convertToDevanagari(latinText: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert in Sanskrit and Devanagari script. Convert the given Sanskrit text from Latin/IAST transliteration to Devanagari script.
Rules:
1. Output ONLY the Devanagari text, no explanations
2. Preserve the meaning and pronunciation accurately
3. Use proper Devanagari conjuncts where appropriate`,
      },
      { role: 'user', content: latinText },
    ],
    temperature: 0.1,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content?.trim() || latinText;
}

async function reprocessMantra(mantraId: string) {
  console.log(`\nProcessing mantra: ${mantraId}`);

  // Fetch mantra
  const { data: mantra, error: fetchError } = await supabase
    .from('mantras')
    .select('id, name, reference_audio_url')
    .eq('id', mantraId)
    .single();

  if (fetchError || !mantra) {
    console.error(`  Error fetching mantra: ${fetchError?.message}`);
    return;
  }

  console.log(`  Name: ${mantra.name}`);
  console.log(`  Audio URL: ${mantra.reference_audio_url}`);

  const audioUrl = mantra.reference_audio_url;
  if (!audioUrl) {
    console.error('  No audio URL');
    return;
  }

  try {
    // Read local audio file
    let audioBuffer: Buffer;
    if (audioUrl.startsWith('/sounds/')) {
      const publicPath = path.join(process.cwd(), 'public', audioUrl);
      console.log(`  Reading file: ${publicPath}`);
      audioBuffer = await fs.readFile(publicPath);
    } else {
      console.error('  Not a local file, skipping');
      return;
    }

    // Transcribe
    console.log('  Transcribing...');
    const latinText = await transcribeAudio(audioBuffer, path.basename(audioUrl));
    console.log(`  Transcription: ${latinText}`);

    // Convert to Devanagari
    console.log('  Converting to Devanagari...');
    const devanagariText = await convertToDevanagari(latinText);
    console.log(`  Devanagari: ${devanagariText}`);

    // Update database
    const { error: updateError } = await supabase
      .from('mantras')
      .update({
        reference_text_devanagari: devanagariText,
        reference_text_roman: latinText,
        text_latin: latinText,
        text_devanagari: devanagariText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mantraId);

    if (updateError) {
      console.error(`  Update error: ${updateError.message}`);
      return;
    }

    // Update processing job
    await supabase
      .from('mantra_processing_jobs')
      .upsert({
        mantra_id: mantraId,
        status: 'completed',
        error_message: null,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'mantra_id' });

    console.log('  Success!');
  } catch (error) {
    console.error(`  Processing error: ${error}`);

    // Update processing job with error
    await supabase
      .from('mantra_processing_jobs')
      .upsert({
        mantra_id: mantraId,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      }, { onConflict: 'mantra_id' });
  }
}

async function main() {
  console.log('Reprocessing old mantras...\n');

  const mantraIds = [
    'ec582fae-8609-4c84-a4d3-58e82c9ad820', // Om Namo Bhagavate Vasudevaya
    '705e3393-c531-470a-8578-8ada8ab4eafd', // Yada Yada Hi Dharmasya
    'e05c9c66-2c8a-4ca5-96af-87406e8f3f83', // Idam Tu Te Guhyatamam
  ];

  for (const id of mantraIds) {
    await reprocessMantra(id);
  }

  console.log('\nDone!');
}

main().catch(console.error);
