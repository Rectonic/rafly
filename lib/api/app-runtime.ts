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
// Type only. The value import is required lazily inside makeDemoRuntime
// below, so a pilot build where supabase is configured, and therefore never
// calls that function, never evaluates lib/test-kit at all. import type is
// erased entirely at compile time and carries no runtime module edge, real
// require() calls are what a bundler's dependency graph sees.
import type {
  DefaultScenario,
  InMemoryStoreCore,
  makeDefaultScenario,
} from "@/lib/test-kit";

export interface AppRuntimeV2 {
  buyerApi: BuyerMarketplaceApiV2;
  sellerApi: SellerStoreApiV2;
  flagSource: () => Promise<FeatureFlagsV2>;
  /** Which backend the facades ended up on, for diagnostics and tests. */
  backend: "supabase" | "demo";
}

function makeDemoRuntime(): AppRuntimeV2 {
  // Lazy required, not imported at module scope. InMemoryStoreCore is about
  // 45KB of test scaffolding that only a build with no supabase env has any
  // use for, and this is the one call site that fake ever gets constructed
  // from. Requiring it here instead of at the top of the file keeps that
  // cost off a pilot launch that never reaches this function.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see above
  const testKit = require("@/lib/test-kit") as {
    InMemoryStoreCore: new () => InMemoryStoreCore;
    makeDefaultScenario: typeof makeDefaultScenario;
  };
  const core = new testKit.InMemoryStoreCore();
  const scenario: DefaultScenario = testKit.makeDefaultScenario(core);

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
