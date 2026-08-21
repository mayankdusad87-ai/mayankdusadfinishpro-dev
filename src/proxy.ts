import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/login', '/supervisor/login', '/auth/reset-password'];

// ---- Global API rate limiting at the proxy level ----
// This catches brute-force abuse BEFORE auth runs (which does a Supabase roundtrip).
// Per-route rate limiters in route handlers add finer-grained control on top.

interface RateLimitEntry { timestamps: number[] }

const globalForProxy = globalThis as typeof globalThis & {
  _proxyRateLimiter?: Map<string, RateLimitEntry>;
};
if (!globalForProxy._proxyRateLimiter) {
  globalForProxy._proxyRateLimiter = new Map();
}
const proxyRateLimitStore = globalForProxy._proxyRateLimiter;

const PROXY_RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 }; // 120 API requests/min per IP (global ceiling; per-route limits are tighter)
let proxyLastCleanup = Date.now();

function proxyRateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const now = Date.now();
  const cutoff = now - PROXY_RATE_LIMIT.windowMs;

  // Periodic cleanup (every 5 minutes)
  if (now - proxyLastCleanup > 5 * 60_000) {
    proxyLastCleanup = now;
    for (const [key, entry] of proxyRateLimitStore) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) proxyRateLimitStore.delete(key);
    }
  }

  let entry = proxyRateLimitStore.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    proxyRateLimitStore.set(ip, entry);
  }

  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= PROXY_RATE_LIMIT.maxRequests) {
    const retryAfterMs = entry.timestamps[0] + PROXY_RATE_LIMIT.windowMs - now;
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
          'X-RateLimit-Limit': String(PROXY_RATE_LIMIT.maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  entry.timestamps.push(now);
  return null;
}

// ---- Proxy handler ----

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Apply global rate limit to all API routes before any auth work
  if (pathname.startsWith('/api/')) {
    const limited = proxyRateLimit(request);
    if (limited) return limited;
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'management' && profile?.role !== 'finishing_team') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/supervisor/home', request.url));
    }
  }

  if (pathname.startsWith('/supervisor') && !pathname.startsWith('/supervisor/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/supervisor/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
