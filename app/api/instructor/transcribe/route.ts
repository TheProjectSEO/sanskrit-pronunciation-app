import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { transcribeAudio, convertToDevanagari, validateTranscription } from '@/lib/audio/whisper';

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

    // Step 1: Transcribe with OpenAI Whisper FIRST (before creating mantra)
    console.log('Starting transcription...');
    const transcription = await transcribeAudio(buffer, audioFile.name || 'audio.webm');
    console.log('Transcription complete:', transcription.text);

    // Step 2: Convert to Devanagari
    console.log('Converting to Devanagari...');
    const devanagariText = await convertToDevanagari(transcription.text);
    console.log('Devanagari conversion complete:', devanagariText);

    // Step 3: Validate transcription with AI
    const validation = await validateTranscription(transcription.text, devanagariText);

    // Step 4: Generate a unique ID for audio storage
    const mantraId = crypto.randomUUID();

    // Step 5: Upload audio to Supabase Storage
    const audioPath = `mantras/${mantraId}/audio.webm`;
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(audioPath, buffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      // Continue without audio URL - not critical
    }

    // Get public URL for audio
    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(audioPath);

    // Step 6: NOW create mantra record with ALL required data
    const mantraName = transcription.text.substring(0, 100) || `Mantra ${new Date().toISOString()}`;

    // Database schema requires these NOT NULL columns:
    // - id (auto-generated)
    // - name (required)
    // - reference_text_devanagari (required)
    // - reference_text_roman (required)
    // - reference_audio_url (required)
    const audioUrl = urlData?.publicUrl || '';

    const { data: mantra, error: mantraError } = await supabase
      .from('mantras')
      .insert({
        id: mantraId,
        name: mantraName,
        reference_text_devanagari: devanagariText,
        reference_text_roman: transcription.text,
        reference_audio_url: audioUrl,
        text_latin: transcription.text,
        text_devanagari: devanagariText,
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

    // Step 7: Create processing job as completed
    const { error: jobError } = await supabase
      .from('mantra_processing_jobs')
      .insert({
        mantra_id: mantra.id,
        status: 'completed',
        created_by: userId,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

    if (jobError) {
      console.error('Error creating processing job:', jobError);
    }

    return NextResponse.json({
      mantra_id: mantra.id,
      text_latin: transcription.text,
      text_devanagari: devanagariText,
      confidence: validation.confidence,
      audio_url: urlData?.publicUrl || null,
    });
  } catch (error) {
    console.error('Error in POST /api/instructor/transcribe:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
