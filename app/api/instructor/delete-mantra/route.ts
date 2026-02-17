import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get mantra ID from query params
    const { searchParams } = new URL(request.url);
    const mantraId = searchParams.get('id');

    if (!mantraId) {
      return NextResponse.json({ error: 'Mantra ID is required' }, { status: 400 });
    }

    // Get the mantra to check ownership and get audio URL
    const { data: mantra, error: fetchError } = await supabase
      .from('mantras')
      .select('id, created_by, reference_audio_url')
      .eq('id', mantraId)
      .single();

    if (fetchError || !mantra) {
      return NextResponse.json({ error: 'Mantra not found' }, { status: 404 });
    }

    // Delete the audio file from storage if it exists
    if (mantra.reference_audio_url) {
      try {
        // Extract the path from the URL
        const url = new URL(mantra.reference_audio_url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/audio\/(.+)/);
        if (pathMatch) {
          const filePath = pathMatch[1];
          await supabase.storage.from('audio').remove([filePath]);
        }
      } catch (storageError) {
        console.error('Error deleting audio file:', storageError);
        // Continue with mantra deletion even if audio deletion fails
      }
    }

    // Delete the mantra from database
    const { error: deleteError } = await supabase
      .from('mantras')
      .delete()
      .eq('id', mantraId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete mantra' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Mantra deleted successfully' });
  } catch (error) {
    console.error('Delete mantra error:', error);
    return NextResponse.json({ error: 'Failed to delete mantra' }, { status: 500 });
  }
}
