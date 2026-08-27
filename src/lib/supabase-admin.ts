import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Lazy singleton — avoids "supabaseUrl is required" crash during
 * Vercel's build-time static page collection when env vars aren't set.
 */
let _client: SupabaseClient<Database> | null = null;

export const supabaseAdmin: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    if (!_client) {
      _client = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
    }
    return Reflect.get(_client, prop, receiver);
  },
});
