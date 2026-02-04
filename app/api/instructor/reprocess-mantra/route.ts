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

    const { mantra_id } = await request.json();
    if (!mantra_id) {
      return NextResponse.json({ error: 'Mantra ID is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const userId = session.user.id;

    // Fetch the mantra to get audio URL
    const { data: mantra, error: fetchError } = await supabase
      .from('mantras')
      .select('id, name, reference_audio_url, audio_url')
      .eq('id', mantra_id)
      .eq('created_by', userId)
      .single();

    if (fetchError || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    const audioUrl = mantra.reference_audio_url || mantra.audio_url;
    if (!audioUrl) {
      return NextResponse.json({ error: 'No audio file available for this mantra' }, { status: 400 });
    }

    // Update processing job to processing
    await supabase
      .from('mantra_processing_jobs')
      .upsert({
        mantra_id: mantra.id,
        status: 'processing',
        error_message: null,
        created_by: userId,
        started_at: new Date().toISOString(),
        completed_at: null,
      }, { onConflict: 'mantra_id' });

    try {
      // Fetch audio file
      let audioBuffer: Buffer;

      if (audioUrl.startsWith('http')) {
        // External URL - fetch it
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error('Failed to fetch audio file');
        }
        const arrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
      } else if (audioUrl.startsWith('/sounds/')) {
        // Local file in public directory - this is a reference file
        // For local files, we need to read from the filesystem
        const fs = await import('fs/promises');
        const path = await import('path');
        const publicPath = path.join(process.cwd(), 'public', audioUrl);
        audioBuffer = await fs.readFile(publicPath);
      } else {
        throw new Error('Invalid audio URL format');
      }

      // Get filename from URL
      const filename = audioUrl.split('/').pop() || 'audio.webm';

      // Transcribe with OpenAI Whisper
      console.log('Reprocessing: Starting transcription...');
      const transcription = await transcribeAudio(audioBuffer, filename);
      console.log('Reprocessing: Transcription complete:', transcription.text);

      // Convert to Devanagari
      console.log('Reprocessing: Converting to Devanagari...');
      const devanagariText = await convertToDevanagari(transcription.text);
      console.log('Reprocessing: Devanagari conversion complete:', devanagariText);

      // Validate transcription
      await validateTranscription(transcription.text, devanagariText);

      // Update mantra with new transcription
      const { error: updateError } = await supabase
        .from('mantras')
        .update({
          reference_text_devanagari: devanagariText,
          reference_text_roman: transcription.text,
          text_latin: transcription.text,
          text_devanagari: devanagariText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mantra.id);

      if (updateError) {
        throw new Error('Failed to update mantra: ' + updateError.message);
      }

      // Update processing job to completed
      await supabase
        .from('mantra_processing_jobs')
        .update({
          status: 'completed',
          error_message: null,
          completed_at: new Date().toISOString(),
        })
        .eq('mantra_id', mantra.id);

      return NextResponse.json({
        success: true,
        text_latin: transcription.text,
        text_devanagari: devanagariText,
      });
    } catch (processingError) {
      console.error('Reprocessing error:', processingError);

      // Update processing job to failed
      await supabase
        .from('mantra_processing_jobs')
        .update({
          status: 'failed',
          error_message: processingError instanceof Error ? processingError.message : 'Processing failed',
          completed_at: new Date().toISOString(),
        })
        .eq('mantra_id', mantra.id);

      throw processingError;
    }
  } catch (error) {
    console.error('Error in POST /api/instructor/reprocess-mantra:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocessing failed' },
      { status: 500 }
    );
  }
}
