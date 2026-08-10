/**
 * App root wiring tests.
 *
 * Two things are being pinned. First, that the root layout really does mount
 * FeatureFlagsProvider and ApiProvider above the navigator, since every buyer
 * and seller v2 hook reads those through optional accessors and silently
 * stays on the legacy path when they are missing. Second, that a build with no
 * Supabase environment still comes up, on the in memory fake and in demo mode,
 * rather than crashing or quietly reporting pilot.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { render, waitFor } from "@testing-library/react-native";
import React from "react";

import type { InventorySummaryV2 } from "@/lib/contracts";

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  const { Text } = require("react-native");
  const { ApiContext } = require("@/lib/api");
  const { useFeatureFlags } = require("@/lib/feature-flags");

  return {
    useRouter: () => ({ push: jest.fn() }),
    // Stands in for the navigator so a probe can report what the providers
    // above it resolved to.
    Stack: () => {
      const api = ReactModule.useContext(ApiContext);
      const flags = useFeatureFlags();
      return ReactModule.createElement(
        Text,
        { testID: "provider-probe" },
        [
          api ? "buyer-api" : "no-buyer-api",
          api?.sellerApi ? "seller-api" : "no-seller-api",
          flags.flags.marketplaceMode,
          flags.status,
        ].join("|")
      );
    },
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
}));

jest.mock("@/lib/pickup-reminders", () => ({
  configurePickupReminderNotifications: jest.fn(),
}));

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return { GestureHandlerRootView: View };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaProvider: View };
});

jest.mock("@/lib/providers", () => {
  const { View } = require("react-native");
  return { AppProviders: View };
});

describe("RootLayout provider wiring", () => {
  it("mounts both coordinator providers above the navigator", async () => {
    const RootLayout = require("@/app/_layout").default;

    const screen = render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("provider-probe")).toHaveTextContent(
        "buyer-api|seller-api|demo|ready"
      );
    });
  });
});

describe("makeAppRuntime", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("falls back to the in memory fake and a demo source with no supabase client", async () => {
    jest.doMock("@/lib/supabase", () => ({
      supabase: null,
      isSupabaseConfigured: () => false,
    }));
    const { makeAppRuntime } = require("@/lib/api/app-runtime");

    const runtime = makeAppRuntime();

    expect(runtime.backend).toBe("demo");
    await expect(runtime.flagSource()).resolves.toEqual({
      marketplaceMode: "demo",
    });

    // The fake is seeded, so the demo seller surface has a store to work in
    // and the demo buyer surface has an empty but readable marketplace.
    const memberships = await runtime.sellerApi.getMyStoreMembershipsV2();
    expect(memberships.ok).toBe(true);
    expect(memberships.ok && memberships.value).toHaveLength(1);
    expect(memberships.ok && memberships.value[0].role).toBe("manager");

    const offers = await runtime.buyerApi.listMarketplaceOffersV2();
    expect(offers).toEqual({ ok: true, value: [] });
  });

  it("builds the supabase facades when a client exists", () => {
    jest.doMock("@/lib/supabase", () => ({
      supabase: { from: jest.fn(), rpc: jest.fn() },
      isSupabaseConfigured: () => true,
    }));
    const { makeAppRuntime } = require("@/lib/api/app-runtime");

    const runtime = makeAppRuntime();

    expect(runtime.backend).toBe("supabase");
    expect(typeof runtime.buyerApi.reserveOfferV2).toBe("function");
    expect(typeof runtime.sellerApi.approveAndPublishOfferV2).toBe("function");
  });

  it("gives each call its own fake world so one demo session cannot leak into another", async () => {
    jest.doMock("@/lib/supabase", () => ({
      supabase: null,
      isSupabaseConfigured: () => false,
    }));
    const { makeAppRuntime } = require("@/lib/api/app-runtime");

    const first = makeAppRuntime();
    const second = makeAppRuntime();
    const memberships = await first.sellerApi.getMyStoreMembershipsV2();
    if (!memberships.ok) {
      throw new Error("the seeded fake should expose one membership");
    }
    const inventory = await first.sellerApi.listStoreInventoryV2(
      memberships.value[0].storeId
    );
    if (!inventory.ok) {
      throw new Error("the seeded fake should expose inventory");
    }
    const offerable = inventory.value.find(
      (summary: InventorySummaryV2) => summary.maxOfferableQuantity > 0
    );
    if (!offerable) {
      throw new Error("the seeded fake should have one offerable product");
    }

    // The fake numbers its ids from a per world counter, so identity is what
    // separates two worlds, not the ids. Publishing into one and reading the
    // other is the only assertion that actually proves they are separate.
    const published = await first.sellerApi.approveAndPublishOfferV2({
      storeId: memberships.value[0].storeId,
      idempotencyKey: "runtime-publish-1",
      allocation: {
        storeProductId: offerable.storeProductId,
        quantity: 1,
        physicallySetAside: false,
      },
      title: "Runtime isolation box",
      category: "bakery",
      imageUrl: null,
      contents: ["bread"],
      offerPriceUzs: 20000,
      referencePriceUzs: 50000,
      pickupStart: "2026-08-10T17:00:00.000Z",
      pickupEnd: "2026-08-10T20:00:00.000Z",
      allergens: [],
      dietaryBadges: [],
      pickupInstructions: null,
      cancellationPolicy: null,
    });

    expect(published.ok).toBe(true);
    expect(await first.buyerApi.listMarketplaceOffersV2()).toMatchObject({
      ok: true,
      value: [{ title: "Runtime isolation box" }],
    });
    expect(await second.buyerApi.listMarketplaceOffersV2()).toEqual({
      ok: true,
      value: [],
    });
  });
});
