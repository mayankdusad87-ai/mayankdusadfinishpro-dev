import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, password, fullName, phone } = await req.json();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'supervisor', full_name: fullName },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    await supabaseAdmin
      .from('profiles')
      .update({ phone, full_name: fullName, role: 'supervisor' })
      .eq('id', data.user.id);
  }

  return NextResponse.json({ userId: data.user?.id });
}
