import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(';')
    .map((chunk) => {
      const [name, ...rest] = chunk.trim().split('=');
      if (!name || rest.length === 0) return null;
      return { name, value: decodeURIComponent(rest.join('=')) };
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

export function createSupabaseAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServerAuthClient(
  request: Request,
  onSetCookie?: (cookie: {
    name: string;
    value: string;
    options: Record<string, unknown>;
  }) => void,
) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie'));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          onSetCookie?.({
            name: cookie.name,
            value: cookie.value,
            options: cookie.options as Record<string, unknown>,
          });
        });
      },
    },
  });
}
