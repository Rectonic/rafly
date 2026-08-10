import {
  clearPendingClientReservationId,
  loadPendingClientReservationId,
  savePendingClientReservationId,
} from "@/lib/buyer/pending-reservation";

const mockAsyncStorage = new Map<string, string>();

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

describe("pending client reservation id persistence", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
  });

  it("returns null when no attempt was ever recorded for an offer", async () => {
    expect(await loadPendingClientReservationId("offer-1")).toBeNull();
  });

  it("saves and reloads the same id, surviving a simulated restart", async () => {
    await savePendingClientReservationId("offer-1", "reserve-abc");

    expect(await loadPendingClientReservationId("offer-1")).toBe("reserve-abc");
  });

  it("keeps pending ids for different offers independent", async () => {
    await savePendingClientReservationId("offer-1", "reserve-abc");
    await savePendingClientReservationId("offer-2", "reserve-xyz");

    expect(await loadPendingClientReservationId("offer-1")).toBe("reserve-abc");
    expect(await loadPendingClientReservationId("offer-2")).toBe("reserve-xyz");
  });

  it("clears the pending id so a later attempt starts fresh", async () => {
    await savePendingClientReservationId("offer-1", "reserve-abc");
    await clearPendingClientReservationId("offer-1");

    expect(await loadPendingClientReservationId("offer-1")).toBeNull();
  });
});
