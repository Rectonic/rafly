import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement, type ReactNode } from "react";

import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type {
  BuyerReservationV2,
  FeatureFlagsV2,
  MarketplaceOfferV2,
  PublishOfferV2Input,
} from "@/lib/contracts";
import { FeatureFlagsProvider, useFeatureFlags } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

import {
  loadPendingClientReservationId,
  savePendingClientReservationId,
} from "@/lib/buyer/pending-reservation";
import {
  pickupCodeFallbackKeyV2,
  pickupCodeKeyV2,
} from "@/lib/buyer/secure-pickup-code";
import {
  useBuyerReservationsV2,
  useReserveOfferV2,
} from "@/lib/buyer/reservations-v2-store";

const ALLOW_INSECURE_ENV = "EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE";

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();
let mockSecureStoreUnavailable = false;

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockAsyncStorage.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => {
    if (mockSecureStoreUnavailable) {
      return Promise.reject(new Error("A required entitlement isn't present."));
    }
    return Promise.resolve(mockSecureStore.get(key) ?? null);
  }),
  setItemAsync: jest.fn((key: string, value: string) => {
    if (mockSecureStoreUnavailable) {
      return Promise.reject(new Error("A required entitlement isn't present."));
    }
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

function makeWrapperWithSource(
  buyerApi: BuyerMarketplaceApiV2,
  core: InMemoryStoreCore,
  scenario: DefaultScenario,
  source: () => Promise<FeatureFlagsV2>
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      FeatureFlagsProvider,
      { source },
      createElement(
        ApiProvider,
        { buyerApi, sellerApi: core.sellerApi({ userId: scenario.managerUserId }) },
        children
      )
    );
  };
}

function makeWrapper(buyerApi: BuyerMarketplaceApiV2, core: InMemoryStoreCore, scenario: DefaultScenario) {
  return makeWrapperWithSource(buyerApi, core, scenario, pilotSource);
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
    mockSecureStoreUnavailable = false;
    delete process.env[ALLOW_INSECURE_ENV];
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env[ALLOW_INSECURE_ENV];
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

  it("persists the pending clientReservationId across a remount so a retry after a failed attempt reuses it", async () => {
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

    const first = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(flakyBuyerApi, core, scenario),
    });
    await waitFor(() => expect(first.result.current.isPilot).toBe(true));

    await act(async () => {
      await first.result.current.reserve(offer);
    });
    expect(first.result.current.status).toBe("error");

    // A restart drops all in-memory refs and state, only AsyncStorage
    // survives, this hook instance has never seen the first attempt.
    first.unmount();

    const second = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(flakyBuyerApi, core, scenario),
    });
    await waitFor(() => expect(second.result.current.isPilot).toBe(true));

    shouldFail = false;
    await act(async () => {
      await second.result.current.reserve(offer);
    });

    expect(second.result.current.status).toBe("held");
    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).toBe(seenClientReservationIds[1]);
  });

  it("reports a degraded code store and writes nothing unencrypted when SecureStore fails", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    mockSecureStoreUnavailable = true;

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offer);
    });

    // The reservation really is held at the server, so the surface keeps the
    // code it holds in memory for this session. What it must not do is write
    // that code to unencrypted storage or imply it can be recovered later.
    expect(result.current.status).toBe("held");
    expect(result.current.storageDegraded).toBe(true);
    const code = result.current.pickupCode as string;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(expect.anything(), code);
    expect(JSON.stringify([...mockAsyncStorage.entries()])).not.toContain(code);
    expect(mockSecureStore.size).toBe(0);
  });

  it("keeps the unencrypted simulator fallback working when the escape hatch is enabled", async () => {
    process.env[ALLOW_INSECURE_ENV] = "1";
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    mockSecureStoreUnavailable = true;

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offer);
    });

    expect(result.current.status).toBe("held");
    expect(result.current.storageDegraded).toBe(false);
    const reservationId = result.current.reservation?.id as string;
    expect(mockAsyncStorage.get(pickupCodeFallbackKeyV2(reservationId))).toBe(
      result.current.pickupCode
    );
  });

  it("discards a persisted pending id whose replay is already terminal and retries once with a fresh id", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    const staleClientReservationId = "reserve-stale";
    await savePendingClientReservationId(offer.id, staleClientReservationId);

    // The reservation this id created was cancelled, and the cleanup that
    // should have dropped the id never landed. Replaying it hands back a
    // finished reservation, which must never be shown as a fresh hold.
    const staleReservation: BuyerReservationV2 = {
      id: "reservation-stale",
      version: 2,
      offerId: offer.id,
      status: "cancelled_by_buyer",
      quantity: 1,
      offerSnapshot: offer,
      pickupCodeHint: "99",
      holdExpiresAt: offer.pickupEnd,
      createdAt: scenario.now,
      updatedAt: scenario.now,
    };
    const seenClientReservationIds: string[] = [];
    const replayingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: async (input) => {
        seenClientReservationIds.push(input.clientReservationId);
        if (input.clientReservationId === staleClientReservationId) {
          return { ok: true, value: { pickupCode: "LB9999", reservation: staleReservation } };
        }
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(replayingBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offer);
    });

    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).toBe(staleClientReservationId);
    expect(seenClientReservationIds[1]).not.toBe(staleClientReservationId);
    expect(result.current.status).toBe("held");
    expect(result.current.reservation?.status).toBe("held");
    expect(result.current.reservation?.id).not.toBe(staleReservation.id);
    expect(await loadPendingClientReservationId(offer.id)).toBeNull();
    expect(JSON.stringify([...mockAsyncStorage.entries()])).not.toContain(
      staleClientReservationId
    );
  });
});

describe("useBuyerReservationsV2", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
    mockSecureStore.clear();
    mockSecureStoreUnavailable = false;
    jest.clearAllMocks();
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

  it("clears a persisted pending id once the reservation it produced is terminal", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    const held = await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: "client-reservation-1",
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });
    if (!held.ok) throw new Error("expected reserve to succeed");
    await core.buyerApi().cancelReservationV2({
      reservationId: held.value.reservation.id,
      installationId: "installation-a",
      idempotencyKey: "cancel-key-1",
    });
    // The cleanup after that cancellation failed, so the finished attempt
    // still has a pending id on disk waiting to replay itself.
    await savePendingClientReservationId(offer.id, "client-reservation-1");

    const { result } = renderHook(() => useBuyerReservationsV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });

    await waitFor(() => expect(result.current.reservations).toHaveLength(1));
    expect(result.current.reservations[0].status).toBe("cancelled_by_buyer");
    await waitFor(async () =>
      expect(await loadPendingClientReservationId(offer.id)).toBeNull()
    );
  });

  it("drops a pilot reservations response that lands after the mode flipped to demo", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: "client-reservation-1",
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });

    let releaseRequest!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const slowBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getBuyerReservationsV2: async (installationId) => {
        await inFlight;
        return core.buyerApi().getBuyerReservationsV2(installationId);
      },
    };
    const source = jest
      .fn<Promise<FeatureFlagsV2>, []>()
      .mockResolvedValueOnce({ marketplaceMode: "pilot" });

    function useCombined() {
      const flags = useFeatureFlags();
      const list = useBuyerReservationsV2("installation-a");
      return { flags, list };
    }

    const { result } = renderHook(() => useCombined(), {
      wrapper: makeWrapperWithSource(slowBuyerApi, core, scenario, source),
    });
    await waitFor(() => expect(result.current.list.isLoading).toBe(true));

    source.mockResolvedValueOnce({ marketplaceMode: "demo" });
    await act(async () => {
      result.current.flags.reload();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.flags.flags.marketplaceMode).toBe("demo")
    );

    // The pilot request only answers now, after the buyer already left pilot
    // mode. A late answer must never repopulate state the mode flip cleared.
    await act(async () => {
      releaseRequest();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.list.reservations).toEqual([]);
    expect(result.current.list.isLoading).toBe(false);
  });
});
