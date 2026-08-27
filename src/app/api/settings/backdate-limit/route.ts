import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_BACKDATE_DAYS = 3;

/**
 * GET /api/settings/backdate-limit
 * Returns the backdate limit (days) using service role to bypass RLS.
 * Any authenticated user can call this — the value is not sensitive.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'backdate_limit_days')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ days: DEFAULT_BACKDATE_DAYS });
    }

    return NextResponse.json({ days: data.value as number });
  } catch {
    return NextResponse.json({ days: DEFAULT_BACKDATE_DAYS });
  }
}
