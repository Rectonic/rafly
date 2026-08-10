/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import CountSessionV2Screen from "@/app/(seller-tabs)/count-session-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";
import { useCountSessionV2 } from "@/lib/seller/count-session-v2";

/**
 * Sequence 3, count session. A count session submits an immutable
 * observation and gets back adjustment proposals, staff can submit but
 * never decide them, manager and owner can approve or reject, and a
 * decision that races another actor surfaces as stale rather than
 * silently overwriting anything.
 */

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => jest.fn(),
}));

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  return { core, scenario };
}

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  const buyerApiStub = {} as never;
  return (
    <ApiProvider buyerApi={buyerApiStub} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

describe("Seller v2 count session", () => {
  beforeEach(() => {
    mockParams = {};
    mockPush.mockClear();
  });

  describe("useCountSessionV2", () => {
    it("reuses one countSessionId across a retry of the same submit", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.staffUserId });
      const seenSessionIds: string[] = [];
      let attempt = 0;
      const flakyApi: SellerStoreApiV2 = {
        ...workingApi,
        recordInventoryCountV2: async (input) => {
          attempt += 1;
          seenSessionIds.push(input.countSessionId);
          if (attempt === 1) {
            return {
              ok: false,
              error: { code: "network_error", message: "offline", retryable: true },
            };
          }
          return workingApi.recordInventoryCountV2(input);
        },
      };

      const { result } = renderHook(() => useCountSessionV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(flakyApi, children),
      });

      const lines = [
        { observedQuantity: 8, storeProductId: scenario.highConfidenceProductId },
      ];

      await act(async () => {
        await result.current.submit(lines);
      });
      expect(result.current.status).toBe("error");

      await act(async () => {
        await result.current.submit(lines);
      });
      expect(result.current.status).toBe("submitted");

      expect(seenSessionIds).toHaveLength(2);
      expect(seenSessionIds[0]).toBe(seenSessionIds[1]);
    });

    it("accepts zero as an explicit observed quantity and returns the resulting proposal", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.staffUserId });

      const { result } = renderHook(() => useCountSessionV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await act(async () => {
        await result.current.submit([
          { observedQuantity: 0, storeProductId: scenario.lowConfidenceProductId },
        ]);
      });

      expect(result.current.status).toBe("submitted");
      expect(result.current.proposals).toHaveLength(1);
      expect(result.current.proposals[0]).toMatchObject({
        currentQuantity: 6,
        delta: -6,
        proposedQuantity: 0,
      });
    });

    it("marks a decision stale when another actor decided first, then surfaces the terminal state on retry", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });
      const owner = core.sellerApi({ userId: scenario.ownerUserId });

      const { result } = renderHook(() => useCountSessionV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(manager, children),
      });

      await act(async () => {
        await result.current.submit([
          { observedQuantity: 8, storeProductId: scenario.highConfidenceProductId },
        ]);
      });
      const proposal = result.current.proposals[0];

      const raced = await owner.approveStockAdjustmentV2({
        decision: "approve",
        expectedVersion: proposal.version,
        idempotencyKey: "owner-races-first",
        proposalId: proposal.id,
        storeId: scenario.storeId,
      });
      if (!raced.ok) throw new Error("expected the race winner to succeed");

      await act(async () => {
        await result.current.decide(proposal.id, "approve");
      });
      expect(result.current.decisionStatusFor(proposal.id)).toBe("stale");

      await act(async () => {
        await result.current.decide(proposal.id, "approve");
      });
      expect(result.current.decisionStatusFor(proposal.id)).toBe("error");
      expect(result.current.decisionErrorFor(proposal.id)?.code).toBe("invalid_state");
    });
  });

  describe("CountSessionV2Screen", () => {
    it("lets staff select target products, enter zero, submit, and see proposals without approval controls", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.staffUserId });

      const screen = render(providerTree(sellerApi, <CountSessionV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(
        screen.getByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`),
        "8"
      );
      fireEvent.press(
        screen.getByTestId(`count-session-v2-select-${scenario.lowConfidenceProductId}`)
      );
      fireEvent.changeText(
        screen.getByTestId(`count-session-v2-quantity-${scenario.lowConfidenceProductId}`),
        "0"
      );

      fireEvent.press(screen.getByTestId("count-session-v2-submit-button"));

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-proposal-line-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );
      expect(
        screen.getByTestId(`count-session-v2-proposal-line-${scenario.lowConfidenceProductId}`)
      ).toBeTruthy();
      expect(
        screen.getByTestId(`count-session-v2-pending-approval-${scenario.highConfidenceProductId}`)
      ).toBeTruthy();
      expect(
        screen.queryByTestId(`count-session-v2-approve-${scenario.highConfidenceProductId}`)
      ).toBeNull();

      // The submitted lines are now an immutable observation, no quantity
      // input remains editable for either counted product.
      expect(
        screen.queryByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`)
      ).toBeNull();
      expect(
        screen.queryByTestId(`count-session-v2-quantity-${scenario.lowConfidenceProductId}`)
      ).toBeNull();
    });

    it("lets a manager approve a proposal and applies the delta to on hand stock", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <CountSessionV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(
        screen.getByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`),
        "8"
      );
      fireEvent.press(screen.getByTestId("count-session-v2-submit-button"));

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-approve-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`count-session-v2-approve-${scenario.highConfidenceProductId}`)
      );

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-decided-${scenario.highConfidenceProductId}`)
        ).toHaveTextContent("Approved")
      );

      const summaries = await manager.listStoreInventoryV2(scenario.storeId);
      if (!summaries.ok) throw new Error("expected inventory read to succeed");
      const updated = summaries.value.find(
        (item) => item.storeProductId === scenario.highConfidenceProductId
      );
      expect(updated?.onHandQuantity).toBe(8);
    });

    it("lets a manager reject a proposal and leaves on hand stock untouched", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <CountSessionV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(
        screen.getByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`),
        "8"
      );
      fireEvent.press(screen.getByTestId("count-session-v2-submit-button"));

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-reject-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`count-session-v2-reject-${scenario.highConfidenceProductId}`)
      );

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-decided-${scenario.highConfidenceProductId}`)
        ).toHaveTextContent("Rejected")
      );

      const summaries = await manager.listStoreInventoryV2(scenario.storeId);
      if (!summaries.ok) throw new Error("expected inventory read to succeed");
      const updated = summaries.value.find(
        (item) => item.storeProductId === scenario.highConfidenceProductId
      );
      expect(updated?.onHandQuantity).toBe(10);
    });

    it("denies count session access outside staff, manager, and owner", async () => {
      const { core, scenario } = makeWorld();
      core.addMembership({
        role: "operator",
        storeId: scenario.storeId,
        userId: "user-operator",
      });
      const operatorApi = core.sellerApi({ userId: "user-operator" });

      const screen = render(providerTree(operatorApi, <CountSessionV2Screen />));

      await waitFor(() =>
        expect(screen.getByTestId("count-session-v2-forbidden-state")).toBeTruthy()
      );
      expect(
        screen.queryByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
      ).toBeNull();
    });

    it("pre-selects the product passed from the inventory recount action", async () => {
      const { core, scenario } = makeWorld();
      mockParams = { storeProductId: scenario.lowConfidenceProductId };
      const staff = core.sellerApi({ userId: scenario.staffUserId });

      const screen = render(providerTree(staff, <CountSessionV2Screen />));

      await waitFor(() =>
        expect(
          screen.getByTestId(`count-session-v2-quantity-${scenario.lowConfidenceProductId}`)
        ).toBeTruthy()
      );
      expect(
        screen.queryByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`)
      ).toBeNull();
    });
  });
});
