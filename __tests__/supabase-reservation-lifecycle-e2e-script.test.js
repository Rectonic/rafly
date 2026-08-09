/* global describe, expect, it */

const {
  buildRuntimeConfig,
  runReservationLifecycleE2E,
} = require("../scripts/supabase-reservation-lifecycle-e2e.cjs");

describe("Supabase reservation lifecycle backend E2E harness", () => {
  const localEnv = {
    LASTBITE_BACKEND_E2E_SUPABASE_URL: "http://127.0.0.1:54321",
    LASTBITE_BACKEND_E2E_SUPABASE_ANON_KEY: "anon-key",
    LASTBITE_BACKEND_E2E_SELLER_EMAIL: "lastbite-e2e@example.com",
    LASTBITE_BACKEND_E2E_SELLER_PASSWORD: "test-password",
  };

  it("skips safely without credentials unless required", () => {
    expect(buildRuntimeConfig([], {})).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 0,
      })
    );

    expect(buildRuntimeConfig(["--require"], {})).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 1,
      })
    );
  });

  it("blocks remote and production targets unless explicitly allowed", () => {
    const remoteEnv = {
      ...localEnv,
      LASTBITE_BACKEND_E2E_SUPABASE_URL: "https://staging.supabase.co",
      LASTBITE_BACKEND_E2E_TARGET: "staging",
    };

    expect(buildRuntimeConfig(["--require"], remoteEnv)).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 1,
      })
    );

    expect(
      buildRuntimeConfig(["--require"], {
        ...remoteEnv,
        LASTBITE_BACKEND_E2E_ALLOW_REMOTE: "1",
      })
    ).toEqual(expect.objectContaining({ shouldRun: true }));

    expect(
      buildRuntimeConfig(["--require"], {
        ...remoteEnv,
        LASTBITE_BACKEND_E2E_ALLOW_REMOTE: "1",
        LASTBITE_BACKEND_E2E_TARGET: "production",
      })
    ).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 1,
      })
    );
  });

  it("rejects non-e2e seller credentials unless explicitly allowed", () => {
    expect(
      buildRuntimeConfig(["--require"], {
        ...localEnv,
        LASTBITE_BACKEND_E2E_SELLER_EMAIL: "owner@example.com",
      })
    ).toEqual(
      expect.objectContaining({
        shouldRun: false,
        exitCode: 1,
      })
    );

    expect(
      buildRuntimeConfig(["--require"], {
        ...localEnv,
        LASTBITE_BACKEND_E2E_SELLER_EMAIL: "owner@example.com",
        LASTBITE_BACKEND_E2E_ALLOW_NON_E2E_SELLER: "1",
      })
    ).toEqual(expect.objectContaining({ shouldRun: true }));
  });

  it("runs the reservation lifecycle through seller setup and anon RPC paths", async () => {
    const calls = [];
    const offerReads = {
      primary: [
        { id: "offer-primary", quantity_available: 0, status: "sold_out" },
        { id: "offer-primary", quantity_available: 0, status: "sold_out" },
        { id: "offer-primary", quantity_available: 1, status: "published" },
        { id: "offer-primary", quantity_available: 1, status: "published" },
      ],
      race: [{ id: "offer-race", quantity_available: 0, status: "sold_out" }],
    };
    let raceAttempts = 0;

    const adapter = {
      signInSeller: async () => {
        calls.push("seller:sign-in");
        return { id: "seller-1", email: localEnv.LASTBITE_BACKEND_E2E_SELLER_EMAIL };
      },
      ensureSellerProfile: async () => {
        calls.push("seller:profile");
        return { created: false };
      },
      assertAnonDirectWritesBlocked: async () => {
        calls.push("anon:direct-writes-blocked");
      },
      createOffer: async ({ title, quantity_available }) => {
        const marker = title.includes("race") ? "race" : "primary";
        calls.push(`seller:create-offer:${marker}:${quantity_available}`);
        return marker === "race" ? "offer-race" : "offer-primary";
      },
      readOffer: async (offerId) => {
        calls.push(`seller:read-offer:${offerId}`);
        const key = offerId === "offer-race" ? "race" : "primary";
        return offerReads[key].shift();
      },
      countPickupOrders: async (offerId) => {
        calls.push(`seller:count-orders:${offerId}`);
        return 1;
      },
      reserveOffer: async ({ offerId, reservationCode }) => {
        calls.push(`anon:reserve:${offerId}:${reservationCode}`);

        if (reservationCode.endsWith("-SECOND")) {
          throw new Error("Offer is no longer available.");
        }

        if (offerId === "offer-race") {
          raceAttempts += 1;
          if (raceAttempts > 1) {
            throw new Error("Offer is no longer available.");
          }
          return {
            pickup_order_id: "pickup-race",
            quantity_available: 0,
            status: "pending",
          };
        }

        return {
          pickup_order_id: "pickup-primary",
          quantity_available: 0,
          status: "pending",
        };
      },
      cancelReservation: async () => {
        calls.push("anon:cancel");
        return {
          pickup_order_id: "pickup-primary",
          quantity_available: 1,
          status: "cancelled",
        };
      },
      cleanup: async () => {
        calls.push("seller:cleanup");
      },
      signOut: async () => {
        calls.push("seller:sign-out");
      },
    };

    const result = await runReservationLifecycleE2E({
      adapter,
      config: {
        runId: "20260529T010203",
        sellerEmail: localEnv.LASTBITE_BACKEND_E2E_SELLER_EMAIL,
      },
      logger: { log() {}, warn() {}, error() {} },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "passed",
        primaryOfferId: "offer-primary",
        primaryPickupOrderId: "pickup-primary",
        raceOfferId: "offer-race",
      })
    );
    expect(calls).toContain("anon:direct-writes-blocked");
    expect(calls.filter((call) => call.startsWith("anon:reserve:offer-primary")))
      .toHaveLength(3);
    expect(calls.filter((call) => call === "anon:cancel")).toHaveLength(2);
    expect(calls.filter((call) => call.startsWith("anon:reserve:offer-race")))
      .toHaveLength(3);
    expect(calls.at(-2)).toBe("seller:cleanup");
    expect(calls.at(-1)).toBe("seller:sign-out");
  });
});
