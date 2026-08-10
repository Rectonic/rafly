/**
 * Flag source tests.
 *
 * The only rule that matters here is that everything except a clean read of
 * mode pilot resolves demo. A flag source that guesses wrong in the other
 * direction turns a broken read into real reservations against real stores.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MARKETPLACE_MODE_FLAG_ID,
  makeAppFlagSource,
  makeDemoFlagSource,
} from "@/lib/api/flag-source";

interface StubCall {
  table: string;
  column: string;
  value: string;
}

function makeStubClient(
  outcome: { data: unknown; error: unknown } | (() => never),
  calls: StubCall[] = []
): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      calls.push({ table: "app_flags", column, value });
      return builder;
    },
    maybeSingle: async () => {
      if (typeof outcome === "function") {
        return outcome();
      }
      return outcome;
    },
  };

  return {
    from: () => builder,
  } as unknown as SupabaseClient;
}

describe("makeDemoFlagSource", () => {
  it("always resolves the fail closed flags", async () => {
    await expect(makeDemoFlagSource()()).resolves.toEqual({
      marketplaceMode: "demo",
    });
  });
});

describe("makeAppFlagSource", () => {
  it("reads the marketplace_mode row and reports pilot", async () => {
    const calls: StubCall[] = [];
    const source = makeAppFlagSource(
      makeStubClient({ data: { value: { mode: "pilot" } }, error: null }, calls)
    );

    await expect(source()).resolves.toEqual({ marketplaceMode: "pilot" });
    expect(calls).toEqual([
      { table: "app_flags", column: "id", value: MARKETPLACE_MODE_FLAG_ID },
    ]);
  });

  it("reports demo when the row says demo", async () => {
    const source = makeAppFlagSource(
      makeStubClient({ data: { value: { mode: "demo" } }, error: null })
    );

    await expect(source()).resolves.toEqual({ marketplaceMode: "demo" });
  });

  it("fails closed on an error, a missing row, or a malformed value", async () => {
    const cases: { data: unknown; error: unknown }[] = [
      { data: null, error: { message: "permission denied" } },
      { data: null, error: null },
      { data: { value: null }, error: null },
      { data: { value: {} }, error: null },
      { data: { value: { mode: "PILOT" } }, error: null },
      { data: { value: { mode: "beta" } }, error: null },
      { data: { value: "pilot" }, error: null },
    ];

    for (const outcome of cases) {
      const source = makeAppFlagSource(makeStubClient(outcome));
      await expect(source()).resolves.toEqual({ marketplaceMode: "demo" });
    }
  });

  it("fails closed when the client throws instead of returning an error", async () => {
    const source = makeAppFlagSource(
      makeStubClient(() => {
        throw new TypeError("Network request failed");
      })
    );

    await expect(source()).resolves.toEqual({ marketplaceMode: "demo" });
  });
});
