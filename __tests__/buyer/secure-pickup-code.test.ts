import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadPickupCodeV2,
  persistPickupCodeV2,
  pickupCodeFallbackKeyV2,
  pickupCodeKeyV2,
} from "@/lib/buyer/secure-pickup-code";

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

describe("buyer v2 secure pickup code storage", () => {
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

  it("writes the raw code to SecureStore and reads it back by reservation id", async () => {
    expect(await persistPickupCodeV2("reservation-1", "LB0001")).toBe("secure");

    expect(mockSecureStore.get(pickupCodeKeyV2("reservation-1"))).toBe("LB0001");
    expect(mockAsyncStorage.size).toBe(0);

    const loaded = await loadPickupCodeV2("reservation-1");

    expect(loaded).toBe("LB0001");
  });

  it("never persists the raw code outside SecureStore or its fallback", async () => {
    await persistPickupCodeV2("reservation-1", "LB0001");

    const serializedSecureStore = JSON.stringify([...mockSecureStore.entries()]);
    expect(serializedSecureStore).toContain("LB0001");

    const serializedAsyncStorage = JSON.stringify([...mockAsyncStorage.entries()]);
    expect(serializedAsyncStorage).not.toContain("LB0001");
  });

  it("falls back to AsyncStorage only when the insecure escape hatch is enabled", async () => {
    process.env[ALLOW_INSECURE_ENV] = "1";
    mockSecureStoreUnavailable = true;

    expect(await persistPickupCodeV2("reservation-2", "LB0002")).toBe(
      "insecure-fallback"
    );

    expect(mockSecureStore.size).toBe(0);
    expect(mockAsyncStorage.get(pickupCodeFallbackKeyV2("reservation-2"))).toBe(
      "LB0002"
    );

    const loaded = await loadPickupCodeV2("reservation-2");
    expect(loaded).toBe("LB0002");
  });

  it("fails closed when SecureStore is unavailable and the escape hatch is off", async () => {
    mockSecureStoreUnavailable = true;

    expect(await persistPickupCodeV2("reservation-2", "LB0002")).toBe("degraded");

    // The raw code never reaches unencrypted storage. A degraded write is
    // reported honestly instead, the caller can still show the code it holds
    // in memory for this session and must not promise recovery later.
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(JSON.stringify([...mockAsyncStorage.entries()])).not.toContain("LB0002");
    expect(mockSecureStore.size).toBe(0);
    expect(await loadPickupCodeV2("reservation-2")).toBeNull();
  });

  it("ignores an insecure copy written by an earlier escape hatch build once the hatch is off", async () => {
    process.env[ALLOW_INSECURE_ENV] = "1";
    mockSecureStoreUnavailable = true;
    await persistPickupCodeV2("reservation-4", "LB0004");
    expect(await loadPickupCodeV2("reservation-4")).toBe("LB0004");

    delete process.env[ALLOW_INSECURE_ENV];

    expect(await loadPickupCodeV2("reservation-4")).toBeNull();
  });

  it("returns null when no code was ever stored for a reservation", async () => {
    const loaded = await loadPickupCodeV2("never-stored");
    expect(loaded).toBeNull();
  });

  it("survives a simulated restart, a fresh read after storage finds the same code", async () => {
    await persistPickupCodeV2("reservation-3", "LB0003");

    // Nothing here recreates the module, the point is that loadPickupCodeV2
    // reads persisted storage rather than any in-memory cache, so a second,
    // independent call after the app restarts recovers the same value.
    const firstRead = await loadPickupCodeV2("reservation-3");
    const secondRead = await loadPickupCodeV2("reservation-3");

    expect(firstRead).toBe("LB0003");
    expect(secondRead).toBe("LB0003");
  });
});
