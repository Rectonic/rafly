import { renderHook, waitFor } from "@testing-library/react-native";

import {
  getInstallationId,
  INSTALLATION_ID_STORAGE_KEY,
  useInstallationId,
} from "@/lib/buyer/installation-id";

const mockAsyncStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
}));

describe("getInstallationId", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
  });

  it("creates and persists an opaque id the first time it is read", async () => {
    const id = await getInstallationId();

    expect(id.length).toBeGreaterThan(10);
    expect(mockAsyncStorage.get(INSTALLATION_ID_STORAGE_KEY)).toBe(id);
  });

  it("returns the same id on every later read, surviving a simulated restart", async () => {
    const first = await getInstallationId();
    const second = await getInstallationId();

    expect(second).toBe(first);
  });

  it("never generates two different ids for concurrent first reads", async () => {
    const [a, b] = await Promise.all([getInstallationId(), getInstallationId()]);

    expect(a).toBe(b);
  });
});

describe("useInstallationId", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
  });

  it("resolves to the persisted installation id", async () => {
    const { result } = renderHook(() => useInstallationId());

    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe(mockAsyncStorage.get(INSTALLATION_ID_STORAGE_KEY));
  });

  it("returns the same installation id after remounting the hook", async () => {
    const first = renderHook(() => useInstallationId());
    await waitFor(() => expect(first.result.current).not.toBeNull());
    const persisted = first.result.current;
    first.unmount();

    const second = renderHook(() => useInstallationId());
    await waitFor(() => expect(second.result.current).not.toBeNull());

    expect(second.result.current).toBe(persisted);
  });
});
