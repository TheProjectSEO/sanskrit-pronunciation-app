import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { FEEDBACK_LANGUAGES } from '@/lib/constants/languages';

const validLanguages = FEEDBACK_LANGUAGES.map((l) => l.code);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('feedback_language')
      .eq('user_id', session.user.id)
      .single();

    return NextResponse.json({
      feedback_language: prefs?.feedback_language || 'hindi',
    });
  } catch (error) {
    console.error('Error in GET /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { feedback_language } = body;

    if (!feedback_language || !validLanguages.includes(feedback_language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: session.user.id,
          feedback_language,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving preferences:', error);
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ feedback_language });
  } catch (error) {
    console.error('Error in PATCH /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
