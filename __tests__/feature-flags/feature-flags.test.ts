import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { FAIL_CLOSED_FLAGS, type FeatureFlagsV2 } from "@/lib/contracts/flags";
import {
  FeatureFlagsProvider,
  useFeatureFlags,
  type FlagSourceV2,
} from "@/lib/feature-flags";

function createWrapper(source: FlagSourceV2) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(FeatureFlagsProvider, { source }, children);
  };
}

describe("useFeatureFlags", () => {
  it("starts fail closed while the source is still loading", () => {
    const source: FlagSourceV2 = () => new Promise(() => {});

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(source),
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.flags).toEqual(FAIL_CLOSED_FLAGS);
  });

  it("flips to ready with the resolved flags once the source succeeds", async () => {
    const source: FlagSourceV2 = () =>
      Promise.resolve<FeatureFlagsV2>({ marketplaceMode: "pilot" });

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(source),
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.flags).toEqual({ marketplaceMode: "pilot" });
  });

  it("falls back to fail closed flags when the source rejects", async () => {
    const source: FlagSourceV2 = () =>
      Promise.reject(new Error("network unavailable"));

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(source),
    });

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.flags).toEqual(FAIL_CLOSED_FLAGS);
  });

  it("recovers via reload after a previously failing source", async () => {
    const source = jest.fn(async (): Promise<FeatureFlagsV2> => {
      throw new Error("unset mock implementation");
    });
    source.mockRejectedValueOnce(new Error("network unavailable"));
    source.mockResolvedValueOnce({ marketplaceMode: "pilot" });

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(source),
    });

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.flags).toEqual(FAIL_CLOSED_FLAGS);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.flags).toEqual({ marketplaceMode: "pilot" });
    expect(source).toHaveBeenCalledTimes(2);
  });

  it("does not update state after unmount while a load is in flight", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    let resolveSource: (flags: FeatureFlagsV2) => void = () => {};
    const source: FlagSourceV2 = () =>
      new Promise<FeatureFlagsV2>((resolve) => {
        resolveSource = resolve;
      });

    const { unmount } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(source),
    });

    unmount();

    await act(async () => {
      resolveSource({ marketplaceMode: "pilot" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("throws when used outside a FeatureFlagsProvider", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useFeatureFlags())).toThrow(
      "FeatureFlagsProvider missing"
    );

    errorSpy.mockRestore();
  });
});
