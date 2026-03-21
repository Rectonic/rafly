import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/auth";

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}
