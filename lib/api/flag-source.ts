/**
 * The app flag source.
 *
 * One row, app_flags with id marketplace_mode, carrying a jsonb value whose
 * mode field is demo or pilot. Anything else, a missing row, a malformed
 * value, a network failure, a permission error, resolves demo. Fail closed is
 * the whole point of this source: the pilot path talks to real stores and real
 * stock, and a flag read that cannot be trusted must never be the reason the
 * app starts taking real reservations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeatureFlagsV2, MarketplaceModeV2 } from "@/lib/contracts";
import { FAIL_CLOSED_FLAGS } from "@/lib/contracts";

export const MARKETPLACE_MODE_FLAG_ID = "marketplace_mode";

type FlagSourceV2 = () => Promise<FeatureFlagsV2>;

function readMode(value: unknown): MarketplaceModeV2 {
  if (value && typeof value === "object" && "mode" in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (mode === "pilot" || mode === "demo") {
      return mode;
    }
  }
  return FAIL_CLOSED_FLAGS.marketplaceMode;
}

/** A source that always resolves the fail closed flags, used with no backend. */
export function makeDemoFlagSource(): FlagSourceV2 {
  return async () => FAIL_CLOSED_FLAGS;
}

export function makeAppFlagSource(client: SupabaseClient): FlagSourceV2 {
  return async () => {
    try {
      const { data, error } = await client
        .from("app_flags")
        .select("value")
        .eq("id", MARKETPLACE_MODE_FLAG_ID)
        .maybeSingle();

      if (error || !data) {
        return FAIL_CLOSED_FLAGS;
      }
      return {
        marketplaceMode: readMode((data as { value: unknown }).value),
      };
    } catch {
      return FAIL_CLOSED_FLAGS;
    }
  };
}
