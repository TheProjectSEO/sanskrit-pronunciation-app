/**
 * Script to fix mantras ownership
 * Sets created_by for existing mantras to the instructor's ID
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INSTRUCTOR_ID = '67ed1cbf-3daa-4581-af8a-83365d295c64'; // aditya@theprojectseo.com

async function fixMantrasOwnership() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Updating mantras ownership...\n');

  // Update mantras without created_by
  const { data: updated, error: updateError } = await supabase
    .from('mantras')
    .update({ created_by: INSTRUCTOR_ID })
    .is('created_by', null)
    .in('text_latin', [
      'Om Namo Bhagavate Vasudevaya',
      'Yada Yada Hi Dharmasya',
      'Idam Tu Te Guhyatamam',
    ])
    .select();

  if (updateError) {
    console.error('Error updating mantras:', updateError);
    process.exit(1);
  }

  console.log(`✅ Updated ${updated?.length || 0} mantras\n`);

  // Fetch all instructor's mantras
  const { data: mantras, error: fetchError } = await supabase
    .from('mantras')
    .select('id, text_latin, text_devanagari, status, created_by, created_at')
    .eq('created_by', INSTRUCTOR_ID)
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Error fetching mantras:', fetchError);
    process.exit(1);
  }

  console.log(`📚 Instructor now has ${mantras?.length || 0} mantras:\n`);
  mantras?.forEach((m, i) => {
    console.log(`${i + 1}. ${m.text_latin}`);
    console.log(`   ${m.text_devanagari}`);
    console.log(`   Status: ${m.status}`);
    console.log(`   ID: ${m.id}\n`);
  });

  console.log('✨ Done!');
}

fixMantrasOwnership().catch(console.error);
