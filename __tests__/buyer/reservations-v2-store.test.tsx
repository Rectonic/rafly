import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement, type ReactNode } from "react";

import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type {
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
  resetReserveInFlightForTests,
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
    resetReserveInFlightForTests();
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

  it("makes exactly one reservation call when two mounted hooks race the same offer", async () => {
    // Two surfaces can be showing the same offer at once, a detail screen and
    // a card sheet for instance. A guard living in one hook's ref cannot see
    // the other hook, so both used to dispatch and the buyer ended up with two
    // reservations for one intent.
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);

    let callCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realApi = core.buyerApi();
    const gatedBuyerApi: BuyerMarketplaceApiV2 = {
      ...realApi,
      reserveOfferV2: async (input) => {
        callCount += 1;
        await gate;
        return realApi.reserveOfferV2(input);
      },
    };
    const wrapper = makeWrapper(gatedBuyerApi, core, scenario);

    const first = renderHook(() => useReserveOfferV2("installation-a"), { wrapper });
    const second = renderHook(() => useReserveOfferV2("installation-a"), { wrapper });
    await waitFor(() => expect(first.result.current.isPilot).toBe(true));
    await waitFor(() => expect(second.result.current.isPilot).toBe(true));

    await act(async () => {
      const a = first.result.current.reserve(offer);
      const b = second.result.current.reserve(offer);
      release();
      await Promise.all([a, b]);
    });

    expect(callCount).toBe(1);
  });

  it("never sends an id minted for one offer as the client id of another", async () => {
    // A failed attempt on offer A leaves its pending id in place on purpose,
    // so a retry of that same attempt stays idempotent. That id belongs to
    // offer A. Sending it as the client id for a reserve on offer B is
    // somebody else's idempotency key from the server's point of view.
    const { core, scenario, seller } = makeWorld();
    const offerA = await publishOffer(core, scenario, seller);
    const offerB = await publishOffer(core, scenario, seller, {
      idempotencyKey: "publish-key-2",
      title: "Second rescue box",
    });

    const sentByOffer = new Map<string, string>();
    const realApi = core.buyerApi();
    const trackingApi: BuyerMarketplaceApiV2 = {
      ...realApi,
      reserveOfferV2: async (input) => {
        sentByOffer.set(input.offerId, input.clientReservationId);
        if (input.offerId === offerA.id) {
          return {
            ok: false,
            error: { code: "network_error", message: "offline", retryable: true },
          };
        }
        return realApi.reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(trackingApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(offerA);
    });
    expect(result.current.status).toBe("error");

    await act(async () => {
      await result.current.reserve(offerB);
    });

    const idForA = sentByOffer.get(offerA.id) as string;
    const idForB = sentByOffer.get(offerB.id) as string;
    expect(idForB).not.toBe(idForA);
    // Each id is the one persisted against its own offer, written before the
    // request went out rather than after it came back.
    expect(await loadPendingClientReservationId(offerA.id)).toBe(idForA);
    expect(result.current.status).toBe("held");
  });

  it("does not let abandon open the door to a duplicate while a request is still in flight", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);

    let callCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realApi = core.buyerApi();
    const gatedBuyerApi: BuyerMarketplaceApiV2 = {
      ...realApi,
      reserveOfferV2: async (input) => {
        callCount += 1;
        await gate;
        return realApi.reserveOfferV2(input);
      },
    };

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(gatedBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      const inFlight = result.current.reserve(offer);
      // The buyer backs out while the request is on the wire. Clearing the in
      // flight mark here would send a second reservation for the same offer
      // while the first one is still outstanding, and the server would honour
      // both.
      result.current.abandon(offer.id);
      const duplicate = result.current.reserve(offer);
      release();
      const [, duplicateResult] = await Promise.all([inFlight, duplicate]);
      expect(duplicateResult).toBeNull();
    });

    expect(callCount).toBe(1);
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

    // A real earlier attempt that really finished. Nothing is faked here: the
    // reservation exists in the store, it was cancelled through the facade,
    // and the cleanup that should have dropped its pending id never landed.
    // Replaying that id now returns the live cancelled row with a null code,
    // which is exactly what the backend does, and it must never be shown as
    // a fresh hold.
    const stale = await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: staleClientReservationId,
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });
    if (!stale.ok) throw new Error("expected reserve to succeed");
    const cancelled = await core.buyerApi().cancelReservationV2({
      reservationId: stale.value.reservation.id,
      installationId: "installation-a",
      idempotencyKey: "cancel-key-1",
    });
    if (!cancelled.ok) throw new Error("expected cancel to succeed");
    await savePendingClientReservationId(offer.id, staleClientReservationId);

    const backing = core.buyerApi();
    const seenClientReservationIds: string[] = [];
    const observedBuyerApi: BuyerMarketplaceApiV2 = {
      ...backing,
      reserveOfferV2: async (input) => {
        seenClientReservationIds.push(input.clientReservationId);
        return backing.reserveOfferV2(input);
      },
    };
    // The screen is looking at the offer as it stands now, two versions on
    // from publish after that hold and its cancellation.
    const current = await backing.getMarketplaceOfferV2(offer.id);
    if (!current.ok) throw new Error("expected the offer to still be readable");

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(observedBuyerApi, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(current.value);
    });

    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).toBe(staleClientReservationId);
    expect(seenClientReservationIds[1]).not.toBe(staleClientReservationId);
    expect(result.current.status).toBe("held");
    expect(result.current.reservation?.status).toBe("held");
    expect(result.current.reservation?.id).not.toBe(stale.value.reservation.id);
    // The retry really did create a new reservation, so it really does carry
    // a freshly issued raw code rather than the replay's null.
    expect(result.current.pickupCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(await loadPendingClientReservationId(offer.id)).toBeNull();
    expect(JSON.stringify([...mockAsyncStorage.entries()])).not.toContain(
      staleClientReservationId
    );
  });

  it("keeps SecureStore authoritative when a replay of a live hold returns a null code", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    const pendingClientReservationId = "reserve-in-flight";

    // The first attempt reached the server and held a unit, the answer never
    // reached the app, so the pending id survived. Retrying replays it.
    const held = await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: pendingClientReservationId,
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });
    if (!held.ok) throw new Error("expected reserve to succeed");
    const issuedCode = held.value.pickupCode;
    if (issuedCode === null) throw new Error("expected a freshly issued code");
    mockSecureStore.set(pickupCodeKeyV2(held.value.reservation.id), issuedCode);
    await savePendingClientReservationId(offer.id, pendingClientReservationId);

    const backing = core.buyerApi();
    const current = await backing.getMarketplaceOfferV2(offer.id);
    if (!current.ok) throw new Error("expected the offer to still be readable");

    const { result } = renderHook(() => useReserveOfferV2("installation-a"), {
      wrapper: makeWrapper(backing, core, scenario),
    });
    await waitFor(() => expect(result.current.isPilot).toBe(true));

    await act(async () => {
      await result.current.reserve(current.value);
    });

    // The hold is real and still live, so the surface shows it as held. The
    // replay carries no raw code, and the code SecureStore already holds is
    // left exactly as it was rather than overwritten or called degraded.
    expect(result.current.status).toBe("held");
    expect(result.current.reservation?.id).toBe(held.value.reservation.id);
    expect(result.current.pickupCode).toBeNull();
    expect(result.current.storageDegraded).toBe(false);
    expect(mockSecureStore.get(pickupCodeKeyV2(held.value.reservation.id))).toBe(
      issuedCode
    );
    // One tap, one reservation, no second unit taken by the replay.
    const reservations = await backing.getBuyerReservationsV2("installation-a");
    if (!reservations.ok) throw new Error("expected the list to succeed");
    expect(reservations.value).toHaveLength(1);
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

  it("never retires a pending id on refresh, even when an older reservation for that offer is terminal", async () => {
    const { core, scenario, seller } = makeWorld();
    const offer = await publishOffer(core, scenario, seller);
    const held = await core.buyerApi().reserveOfferV2({
      offerId: offer.id,
      quantity: 1,
      clientReservationId: "client-reservation-old",
      installationId: "installation-a",
      expectedOfferVersion: offer.version,
    });
    if (!held.ok) throw new Error("expected reserve to succeed");
    await core.buyerApi().cancelReservationV2({
      reservationId: held.value.reservation.id,
      installationId: "installation-a",
      idempotencyKey: "cancel-key-1",
    });

    // The buyer then tapped reserve again on the same offer. That newer
    // attempt never got an answer, so its own pending id is on disk waiting
    // to be retried idempotently. The cancelled reservation above says
    // nothing about it, the list is keyed by offer and carries no client id
    // at all, so a refresh that cleared on sight would destroy this retry
    // and turn the buyer's next tap into a second reservation.
    await savePendingClientReservationId(offer.id, "client-reservation-new");

    const { result } = renderHook(() => useBuyerReservationsV2("installation-a"), {
      wrapper: makeWrapper(core.buyerApi(), core, scenario),
    });

    await waitFor(() => expect(result.current.reservations).toHaveLength(1));
    expect(result.current.reservations[0].status).toBe("cancelled_by_buyer");
    await act(async () => {
      await result.current.refresh();
    });

    expect(await loadPendingClientReservationId(offer.id)).toBe(
      "client-reservation-new"
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
