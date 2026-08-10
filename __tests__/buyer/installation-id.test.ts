/**
 * The installation id is a bearer secret. Anybody holding one can list and
 * cancel that installation's reservations, so it belongs in SecureStore and
 * nowhere else unless the explicit insecure escape hatch is set.
 *
 * These blocks cover the three paths that matter: a clean install, an upgrade
 * from the build that kept the id in AsyncStorage, and a device where
 * SecureStore simply does not work.
 */

import { renderHook, waitFor } from "@testing-library/react-native";

import {
  getInstallationId,
  INSTALLATION_ID_LEGACY_STORAGE_KEY,
  INSTALLATION_ID_SECURE_KEY,
  resetInstallationIdCacheForTests,
  useInstallationId,
} from "@/lib/buyer/installation-id";

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
      return Promise.reject(new Error("SecureStore unavailable"));
    }
    return Promise.resolve(mockSecureStore.get(key) ?? null);
  }),
  setItemAsync: jest.fn((key: string, value: string) => {
    if (mockSecureStoreUnavailable) {
      return Promise.reject(new Error("SecureStore unavailable"));
    }
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
}));

const originalFlag = process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE;

beforeEach(() => {
  mockAsyncStorage.clear();
  mockSecureStore.clear();
  mockSecureStoreUnavailable = false;
  resetInstallationIdCacheForTests();
  delete process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE;
});

afterAll(() => {
  if (originalFlag === undefined) {
    delete process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE;
  } else {
    process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE = originalFlag;
  }
});

describe("getInstallationId", () => {
  it("creates the id in SecureStore and never in plaintext", async () => {
    const id = await getInstallationId();

    expect(id.length).toBeGreaterThan(10);
    expect(mockSecureStore.get(INSTALLATION_ID_SECURE_KEY)).toBe(id);
    expect(mockAsyncStorage.size).toBe(0);
  });

  it("returns the same id on every later read, surviving a simulated restart", async () => {
    const first = await getInstallationId();
    resetInstallationIdCacheForTests();
    const second = await getInstallationId();

    expect(second).toBe(first);
  });

  it("never generates two different ids for concurrent first reads", async () => {
    const [a, b] = await Promise.all([getInstallationId(), getInstallationId()]);

    expect(a).toBe(b);
  });

  it("migrates a legacy AsyncStorage id into SecureStore and deletes the plaintext copy", async () => {
    mockAsyncStorage.set(INSTALLATION_ID_LEGACY_STORAGE_KEY, "install-legacy-value");

    const id = await getInstallationId();

    // The buyer keeps their identity, and with it every reservation attached
    // to it, but the plaintext copy is gone.
    expect(id).toBe("install-legacy-value");
    expect(mockSecureStore.get(INSTALLATION_ID_SECURE_KEY)).toBe("install-legacy-value");
    expect(mockAsyncStorage.has(INSTALLATION_ID_LEGACY_STORAGE_KEY)).toBe(false);
  });

  it("keeps the legacy copy when the secure write fails, rather than losing the identity", async () => {
    mockAsyncStorage.set(INSTALLATION_ID_LEGACY_STORAGE_KEY, "install-legacy-value");
    mockSecureStoreUnavailable = true;

    const id = await getInstallationId();

    expect(id).toBe("install-legacy-value");
    expect(mockAsyncStorage.get(INSTALLATION_ID_LEGACY_STORAGE_KEY)).toBe(
      "install-legacy-value"
    );
  });

  it("writes nothing at all when SecureStore fails and the escape hatch is off", async () => {
    mockSecureStoreUnavailable = true;

    const id = await getInstallationId();

    // Real for this session so reserving still works, gone after a restart.
    // Nothing is written in plaintext to pretend otherwise.
    expect(id.length).toBeGreaterThan(10);
    expect(mockAsyncStorage.size).toBe(0);
    expect(mockSecureStore.size).toBe(0);
    expect(await getInstallationId()).toBe(id);
  });

  it("writes the plaintext fallback only when the escape hatch is on", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE = "1";
    mockSecureStoreUnavailable = true;

    const id = await getInstallationId();

    expect(mockAsyncStorage.get(INSTALLATION_ID_LEGACY_STORAGE_KEY)).toBe(id);
  });
});

describe("useInstallationId", () => {
  it("resolves to the securely persisted installation id", async () => {
    const { result } = renderHook(() => useInstallationId());

    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe(mockSecureStore.get(INSTALLATION_ID_SECURE_KEY));
  });

  it("returns the same installation id after remounting the hook", async () => {
    const first = renderHook(() => useInstallationId());
    await waitFor(() => expect(first.result.current).not.toBeNull());
    const persisted = first.result.current;
    first.unmount();

    resetInstallationIdCacheForTests();
    const second = renderHook(() => useInstallationId());
    await waitFor(() => expect(second.result.current).not.toBeNull());

    expect(second.result.current).toBe(persisted);
  });
});
