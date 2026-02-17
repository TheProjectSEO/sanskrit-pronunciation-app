import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { transcribeAudio, identifyAndCorrectMantra } from '@/lib/audio/whisper';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and instructor role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'instructor') {
      return NextResponse.json({ error: 'Forbidden: Instructor access required' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const userId = session.user.id;

    // Convert File to Buffer for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 1: Transcribe with OpenAI Whisper
    console.log('Starting transcription...');
    const transcription = await transcribeAudio(buffer, audioFile.name || 'audio.webm');
    console.log('Whisper output:', transcription.text);

    // Step 2: Identify the mantra and get correct text using GPT-4o
    console.log('Identifying mantra with GPT-4o...');
    const identified = await identifyAndCorrectMantra(transcription.text);
    console.log(`Identified: "${identified.mantra_name}" (confidence: ${identified.confidence})`);
    console.log(`Roman: ${identified.text_roman}`);
    console.log(`Devanagari: ${identified.text_devanagari}`);

    // Step 3: Generate a unique ID for audio storage
    const mantraId = crypto.randomUUID();

    // Step 4: Upload audio to Supabase Storage
    const audioPath = `mantras/${mantraId}/audio.webm`;
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(audioPath, buffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
    }

    // Get public URL for audio
    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(audioPath);
    const audioUrl = urlData?.publicUrl || '';

    // Step 5: Create mantra with correct identified text
    let mantraName = identified.mantra_name || identified.text_roman.substring(0, 100);

    // Handle duplicate name constraint
    const { data: existing } = await supabase
      .from('mantras')
      .select('name')
      .ilike('name', `${mantraName}%`);

    if (existing && existing.some(e => e.name === mantraName)) {
      mantraName = `${mantraName} (${existing.length + 1})`;
    }

    const { data: mantra, error: mantraError } = await supabase
      .from('mantras')
      .insert({
        id: mantraId,
        name: mantraName,
        reference_text_devanagari: identified.text_devanagari,
        reference_text_roman: identified.text_roman,
        reference_audio_url: audioUrl,
        text_latin: identified.text_roman,
        text_devanagari: identified.text_devanagari,
        audio_url: audioUrl,
        created_by: userId,
        status: 'draft',
      })
      .select()
      .single();

    if (mantraError || !mantra) {
      console.error('Error creating mantra:', mantraError);
      return NextResponse.json({ error: 'Failed to create mantra: ' + (mantraError?.message || 'Unknown error') }, { status: 500 });
    }

    // Step 6: Create processing job as completed
    await supabase
      .from('mantra_processing_jobs')
      .insert({
        mantra_id: mantra.id,
        status: 'completed',
        created_by: userId,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

    return NextResponse.json({
      mantra_id: mantra.id,
      mantra_name: identified.mantra_name,
      text_latin: identified.text_roman,
      text_devanagari: identified.text_devanagari,
      confidence: identified.confidence,
      audio_url: audioUrl,
    });
  } catch (error) {
    console.error('Error in POST /api/instructor/transcribe:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
