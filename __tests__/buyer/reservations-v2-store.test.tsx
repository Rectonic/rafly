import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, MarketplaceOfferV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

import { pickupCodeKeyV2 } from "@/lib/buyer/secure-pickup-code";
import {
  useBuyerReservationsV2,
  useReserveOfferV2,
} from "@/lib/buyer/reservations-v2-store";

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

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 3,
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
    ...overrides,
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

async function publishOffer(
  core: InMemoryStoreCore,
  scenario: DefaultScenario,
  seller: ReturnType<InMemoryStoreCore["sellerApi"]>,
  overrides: Partial<PublishOfferV2Input> = {}
): Promise<MarketplaceOfferV2> {
  const result = await seller.approveAndPublishOfferV2(publishInputFor(scenario, overrides));
  if (!result.ok) throw new Error("expected publish to succeed");
  return result.value;
}

describe("useReserveOfferV2", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
    mockSecureStore.clear();
  });

  it("reserves the offer, holds the raw code in SecureStore only, and exposes the hint through the reservation", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    let reserveResult!: Awaited<ReturnType<typeof result.current.reserve>>;
    await act(async () => {
      reserveResult = await result.current.reserve(offer);
    });

    expect(reserveResult?.ok).toBe(true);
    expect(result.current.status).toBe("held");
    expect(result.current.pickupCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(result.current.reservation?.pickupCodeHint).toBe(
      result.current.pickupCode?.slice(-2)
    );

    const reservationId = result.current.reservation?.id as string;
    expect(mockSecureStore.get(pickupCodeKeyV2(reservationId))).toBe(
      result.current.pickupCode
    );
    expect(JSON.stringify(result.current.reservation)).not.toContain(
      result.current.pickupCode as string
    );
  });

  it("makes exactly one reservation call when the reserve button is tapped twice before it resolves", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);

    let callCount = 0;
    const countingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: (input) => {
        callCount += 1;
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(countingBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      const first = result.current.reserve(offer);
      const second = result.current.reserve(offer);
      await Promise.all([first, second]);
    });

    expect(callCount).toBe(1);
    expect(result.current.status).toBe("held");
  });

  it("reuses the same clientReservationId across a retry after a retryable network failure", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);

    const seenClientReservationIds: string[] = [];
    let shouldFail = true;
    const flakyBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: async (input) => {
        seenClientReservationIds.push(input.clientReservationId);
        if (shouldFail) {
          return {
            ok: false,
            error: { code: "network_error", message: "Network unavailable", retryable: true },
          };
        }
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(flakyBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offer);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.code).toBe("network_error");
    expect(result.current.reservation).toBeNull();
    expect(result.current.pickupCode).toBeNull();

    shouldFail = false;
    await act(async () => {
      await result.current.reserve(offer);
    });

    expect(result.current.status).toBe("held");
    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).toBe(seenClientReservationIds[1]);
  });

  it("generates a fresh clientReservationId for a new reservation after a previous one succeeded", async () => {
    const { core, scenario, seller } = makeWorld();
    const offerA = await publishOffer(core, scenario, seller, { title: "Box A" });
    const offerB = await publishOffer(core, scenario, seller, {
      title: "Box B",
      idempotencyKey: "publish-key-2",
    });

    const seenClientReservationIds: string[] = [];
    const trackingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: (input) => {
        seenClientReservationIds.push(input.clientReservationId);
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(trackingBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offerA);
    });
    await act(async () => {
      await result.current.reserve(offerB);
    });

    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).not.toBe(seenClientReservationIds[1]);
  });

  it("never fabricates a held reservation when the backend reports sold_out", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller, {
      allocation: {
        storeProductId: scenario.highConfidenceProductId,
        quantity: 1,
        physicallySetAside: false,
      },
    });
    await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: "someone-elses-reservation",
      installationId: "another-installation",
      expectedOfferVersion: offer.version,
    });
    const soldOutOffer = (await core.buyerApi().getMarketplaceOfferV2(offer.id)) as {
      ok: true;
      value: MarketplaceOfferV2;
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(soldOutOffer.value);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.code).toBe("sold_out");
    expect(result.current.reservation).toBeNull();
    expect(result.current.pickupCode).toBeNull();
  });

  it("calls the offer changed callback for a stale version so the caller can refresh authoritative data", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    const staleOffer: MarketplaceOfferV2 = { ...offer, version: offer.version - 1 };
    const onOfferChanged = jest.fn();

    const { result } = renderHook(
      () => useReserveOfferV2("installation-a", { onOfferChanged }),
      { wrapper: makeWrapper(core.buyerApi(), core, scenario) }
    );
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(staleOffer);
    });

    expect(result.current.error?.code).toBe("version_conflict");
    expect(onOfferChanged).toHaveBeenCalledTimes(1);
  });

  it("degrades to a no-op outside pilot mode", async () => {
    const { result } = renderHook(() => useReserveOfferV2("installation-a"));

    let reserveResult!: Awaited<ReturnType<typeof result.current.reserve>>;
    await act(async () => {
      reserveResult = await result.current.reserve({
        id: "offer-1",
        version: 1,
      } as MarketplaceOfferV2);
    });

    expect(reserveResult).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});

describe("useBuyerReservationsV2", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
    mockSecureStore.clear();
  });

  it("recovers a held reservation for this installation after a simulated restart", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: "client-reservation-1",
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });

    // A fresh hook instance stands in for the app restarting, it has no
    // memory of the reservation just created above except what the server
    // returns for this installation id.
    const { result } = renderHook(() => useBuyerReservationsV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });

    await waitFor(() => expect(result.current.reservations).toHaveLength(1));
    expect(result.current.reservations[0].offerId).toBe(offer.id);
    expect(result.current.reservations[0].status).toBe("held");
    expect(JSON.stringify(result.current.reservations)).not.toMatch(/^[A-Z0-9]{6}$/);
  });

  it("surfaces a retryable error without throwing when the list request fails", async () => {
    const { core, scenario } = makeWorld();
    const failingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getBuyerReservationsV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Network unavailable", retryable: true },
      }),
    };

    const { result } = renderHook(() => useBuyerReservationsV2("installation-a"), {
      wrapper: makeWrapper(failingBuyerApi, core, scenario),
    });

    await waitFor(() => expect(result.current.error).toBe("Network unavailable"));
    expect(result.current.reservations).toEqual([]);
  });
});
