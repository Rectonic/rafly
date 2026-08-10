/**
 * What the app root mounts.
 *
 * This module is the one place that decides whether the running app talks to
 * Supabase or to the in memory fake, and it is deliberately the only file
 * outside lib/supabase.ts that reads the client. The root layout imports the
 * result, not the decision, so no screen ever learns which backend it is on.
 *
 * Two shapes:
 *
 * - supabase configured: the real facades plus the app_flags backed source,
 *   which starts demo and only reports pilot when the row says so
 * - nothing configured: the in memory Store Core seeded with the standard
 *   demo scenario, plus a source that always resolves demo
 *
 * The buyer surface additionally gates on the flag resolving to pilot, so a
 * demo build keeps the v1 experience it has always had even with a provider
 * mounted above it.
 */

import { makeAppFlagSource, makeDemoFlagSource } from "@/lib/api/flag-source";
import type { BuyerMarketplaceApiV2 } from "@/lib/api/buyer-api";
import type { SellerStoreApiV2 } from "@/lib/api/seller-api";
import { makeSupabaseBuyerApi } from "@/lib/api/supabase-buyer-api";
import { makeSupabaseSellerApi } from "@/lib/api/supabase-seller-api";
import type { FeatureFlagsV2 } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

export interface AppRuntimeV2 {
  buyerApi: BuyerMarketplaceApiV2;
  sellerApi: SellerStoreApiV2;
  flagSource: () => Promise<FeatureFlagsV2>;
  /** Which backend the facades ended up on, for diagnostics and tests. */
  backend: "supabase" | "demo";
}

function makeDemoRuntime(): AppRuntimeV2 {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);

  return {
    buyerApi: core.buyerApi(),
    // A demo build has no sign in, so the fake is bound to the scenario
    // manager. That is the role the seller screens are designed around, it
    // can publish and pause but is not the owner.
    sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
    flagSource: makeDemoFlagSource(),
    backend: "demo",
  };
}

export function makeAppRuntime(): AppRuntimeV2 {
  if (!supabase) {
    return makeDemoRuntime();
  }

  return {
    buyerApi: makeSupabaseBuyerApi(supabase),
    sellerApi: makeSupabaseSellerApi(supabase),
    flagSource: makeAppFlagSource(supabase),
    backend: "supabase",
  };
}
