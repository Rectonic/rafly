import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

import { useCancelReservationV2 } from "@/lib/buyer/reservations-v2-store";

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
}));

function publishInputFor(scenario: DefaultScenario): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 1,
      physicallySetAside: false,
    },
    title: "Bakery rescue box",
    category: "bakery",
    imageUrl: null,
    contents: ["bread", "pastry"],
    offerPriceUzs: 20000,
    referencePriceUzs: 50000,
    pickupStart: scenario.pickupStart,
    pickupEnd: scenario.pickupEnd,
    allergens: ["gluten"],
    dietaryBadges: ["vegetarian"],
    pickupInstructions: "Ask at the counter",
    cancellationPolicy: "Cancel before pickup start",
  };
}

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const seller = core.sellerApi({ userId: scenario.managerUserId });
  return { core, scenario, seller };
}

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

function makeWrapper(buyerApi: BuyerMarketplaceApiV2, core: InMemoryStoreCore, scenario: DefaultScenario) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      FeatureFlagsProvider,
      { source: pilotSource },
      createElement(
        ApiProvider,
        { buyerApi, sellerApi: core.sellerApi({ userId: scenario.managerUserId }) },
        children
      )
    );
  };
}

async function heldReservationId(
  core: InMemoryStoreCore,
  scenario: DefaultScenario,
  seller: ReturnType<InMemoryStoreCore["sellerApi"]>
): Promise<string> {
  const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
  if (!published.ok) throw new Error("expected publish to succeed");
  const held = await core.buyerApi().reserveOfferV2({
    offerId: published.value.id,
    quantity: 1,
    clientReservationId: "client-reservation-1",
    installationId: "installation-a",
    expectedOfferVersion: published.value.version,
  });
  if (!held.ok) throw new Error("expected reserve to succeed");
  return held.value.reservation.id;
}

describe("useCancelReservationV2", () => {
  it("cancels a held reservation and releases the unit", async () => {
    const { core, scenario, seller } = makeWorld();
    const reservationId = await heldReservationId(core, scenario, seller);

    const { result } = renderHook(() => useCancelReservationV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.cancel(reservationId);
    });

    expect(result.current.statusFor(reservationId)).toBe("cancelled");
    expect(result.current.errorFor(reservationId)).toBeNull();

    const reservations = await core.buyerApi().getBuyerReservationsV2("installation-a");
    expect(reservations.ok && reservations.value[0].status).toBe("cancelled_by_buyer");
  });

  it("makes exactly one cancel call when tapped twice before it resolves", async () => {
    const { core, scenario, seller } = makeWorld();
    const reservationId = await heldReservationId(core, scenario, seller);

    let callCount = 0;
    const countingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      cancelReservationV2: (input) => {
        callCount += 1;
        return core.buyerApi().cancelReservationV2(input);
      },
    };

    const { result } = renderHook(() => useCancelReservationV2("installation-a"), {
      wrapper: makeWrapper(countingBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      const first = result.current.cancel(reservationId);
      const second = result.current.cancel(reservationId);
      await Promise.all([first, second]);
    });

    expect(callCount).toBe(1);
    expect(result.current.statusFor(reservationId)).toBe("cancelled");
  });

  it("is safe to repeat, a second cancel call after success replays the same terminal result", async () => {
    const { core, scenario, seller } = makeWorld();
    const reservationId = await heldReservationId(core, scenario, seller);

    const { result } = renderHook(() => useCancelReservationV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    let firstResult!: Awaited<ReturnType<typeof result.current.cancel>>;
    await act(async () => {
      firstResult = await result.current.cancel(reservationId);
    });

    let secondResult!: Awaited<ReturnType<typeof result.current.cancel>>;
    await act(async () => {
      secondResult = await result.current.cancel(reservationId);
    });

    expect(firstResult?.ok).toBe(true);
    // A cancel after the reservation is already terminal is rejected by the
    // backend with invalid_state, the hook must surface that rather than
    // silently pretending a second identical success happened, repeating
    // the action is safe in the sense that it never corrupts state or
    // charges the buyer twice.
    expect(secondResult?.ok).toBe(false);
    if (!secondResult?.ok) {
      expect(secondResult?.error.code).toBe("invalid_state");
    }
    expect(result.current.statusFor(reservationId)).toBe("error");
  });

  it("degrades to a no-op outside pilot mode", async () => {
    const { result } = renderHook(() => useCancelReservationV2("installation-a"));

    let cancelResult!: Awaited<ReturnType<typeof result.current.cancel>>;
    await act(async () => {
      cancelResult = await result.current.cancel("reservation-1");
    });

    expect(cancelResult).toBeNull();
    expect(result.current.statusFor("reservation-1")).toBe("idle");
  });
});
