import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabaseAdmin must not be used in browser code. " +
        "Use @/lib/supabase/client instead."
    );
  }

  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

/**
 * Server-side Supabase client with service role key (bypasses RLS).
 *
 * Protected by three layers:
 * 1. `import "server-only"` — build-time error if bundled into a client chunk
 * 2. `typeof window` runtime guard — hard crash if somehow invoked in a browser
 * 3. Non-NEXT_PUBLIC env vars — Next.js strips these from client bundles by default
 *
 * Lazy-initialized via Proxy so the top-level export doesn't throw during
 * build-time page data collection.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
