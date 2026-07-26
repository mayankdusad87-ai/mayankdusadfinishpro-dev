import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId, isActive } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!isActive) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  } else {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
