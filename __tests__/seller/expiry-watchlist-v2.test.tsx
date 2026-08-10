/* eslint-disable @typescript-eslint/no-require-imports */
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import ExpiryV2Screen from "@/app/(seller-tabs)/expiry-v2";
import InventoryV2Screen from "@/app/(seller-tabs)/inventory-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { ExpiryWatchItemV2, Result } from "@/lib/contracts";
import { useExpiryWatchlistV2 } from "@/lib/seller/expiry-watchlist-v2-store";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
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
  useLocale: () => "ru",
  useSetLocale: () => jest.fn(),
}));

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  return (
    <ApiProvider buyerApi={{} as never} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const todayProductId = core.addProduct({
    storeId: scenario.storeId,
    productName: "Сегодняшний кефир",
    onHandQuantity: 2,
    confidence: "high",
    expiryDate: "2026-08-10",
  });
  const tomorrowProductId = core.addProduct({
    storeId: scenario.storeId,
    productName: "Завтрашнее молоко",
    onHandQuantity: 3,
    confidence: "high",
    expiryDate: "2026-08-11",
  });
  const offerCandidateProductId = core.addProduct({
    storeId: scenario.storeId,
    productName: "Офферный сыр",
    onHandQuantity: 4,
    confidence: "high",
    expiryDate: "2026-08-14",
  });
  const observationProductId = core.addProduct({
    storeId: scenario.storeId,
    productName: "Дальняя крупа",
    onHandQuantity: 5,
    confidence: "high",
    expiryDate: "2026-08-18",
  });
  return {
    core,
    observationProductId,
    offerCandidateProductId,
    scenario,
    todayProductId,
    tomorrowProductId,
  };
}

describe("Seller expiry watchlist v2", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the fake's urgency order, deterministic chips, and required colors", async () => {
    const world = makeWorld();
    const sellerApi = world.core.sellerApi({
      userId: world.scenario.managerUserId,
    });
    const screen = render(providerTree(sellerApi, <ExpiryV2Screen />));

    await waitFor(() =>
      expect(screen.getByTestId("expiry-v2-item-summary")).toBeTruthy()
    );

    const rows = screen.getAllByTestId(/^expiry-v2-row-/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      `expiry-v2-row-${world.scenario.expiredProductId}`,
      `expiry-v2-row-${world.todayProductId}`,
      `expiry-v2-row-${world.tomorrowProductId}`,
      `expiry-v2-row-${world.scenario.highConfidenceProductId}`,
      `expiry-v2-row-${world.offerCandidateProductId}`,
      `expiry-v2-row-${world.scenario.lowConfidenceProductId}`,
      `expiry-v2-row-${world.observationProductId}`,
    ]);

    expect(
      screen.getByTestId(`expiry-v2-suggestion-${world.scenario.expiredProductId}`)
    ).toHaveTextContent("снять с полки");
    expect(
      screen.getByTestId(`expiry-v2-suggestion-${world.tomorrowProductId}`)
    ).toHaveTextContent("уценка 50");
    expect(
      screen.getByTestId(`expiry-v2-suggestion-${world.scenario.highConfidenceProductId}`)
    ).toHaveTextContent("уценка 30");
    expect(
      screen.getByTestId(`expiry-v2-suggestion-${world.offerCandidateProductId}`)
    ).toHaveTextContent("уценка 15 + кандидат в оффер");
    expect(
      screen.getByTestId(`expiry-v2-suggestion-${world.observationProductId}`)
    ).toHaveTextContent("наблюдение");
    expect(
      screen.getByTestId(`expiry-v2-recount-${world.scenario.lowConfidenceProductId}`)
    ).toHaveTextContent("пересчитать сначала");

    expect(
      screen.getByTestId(`expiry-v2-days-${world.scenario.expiredProductId}`)
    ).toHaveStyle({ color: "#FF6B6B" });
    expect(
      screen.getByTestId(`expiry-v2-days-${world.scenario.highConfidenceProductId}`)
    ).toHaveStyle({ color: "#E0A63C" });
    expect(
      screen.getByTestId(`expiry-v2-days-${world.offerCandidateProductId}`)
    ).toHaveStyle({ color: "#101418" });
  });

  it("routes recount and offer candidates only through existing flows", async () => {
    const world = makeWorld();
    const sellerApi = world.core.sellerApi({
      userId: world.scenario.managerUserId,
    });
    const screen = render(providerTree(sellerApi, <ExpiryV2Screen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`expiry-v2-recount-${world.scenario.lowConfidenceProductId}`)
      ).toBeTruthy()
    );

    fireEvent.press(
      screen.getByTestId(`expiry-v2-recount-${world.scenario.lowConfidenceProductId}`)
    );
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/(seller-tabs)/count-session-v2",
      params: { storeProductId: world.scenario.lowConfidenceProductId },
    });

    fireEvent.press(
      screen.getByTestId(`expiry-v2-publish-${world.offerCandidateProductId}`)
    );
    expect(mockPush).toHaveBeenLastCalledWith("/(seller-tabs)/publish-v2");
  });

  it("keeps recount and publish routing unavailable to an operator", async () => {
    const core = new InMemoryStoreCore();
    const storeId = core.createStore({
      name: "Operator store",
      pilotModeEnabled: true,
      shopSellerBetaEnabled: true,
    });
    core.addMembership({ storeId, userId: "user-operator", role: "operator" });
    const productId = core.addProduct({
      storeId,
      productName: "Непроверенный творог",
      onHandQuantity: 2,
      confidence: "low",
      expiryDate: "2026-08-14",
    });
    const screen = render(
      providerTree(
        core.sellerApi({ userId: "user-operator" }),
        <ExpiryV2Screen />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`expiry-v2-row-${productId}`)).toBeTruthy()
    );
    expect(screen.getByTestId(`expiry-v2-recount-note-${productId}`)).toHaveTextContent(
      "пересчитать сначала"
    );
    expect(screen.queryByTestId(`expiry-v2-recount-${productId}`)).toBeNull();
    expect(screen.queryByTestId(`expiry-v2-publish-${productId}`)).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not request the watchlist when the active store has beta access disabled", async () => {
    const core = new InMemoryStoreCore();
    const storeId = core.createStore({
      name: "Disabled store",
      pilotModeEnabled: true,
      shopSellerBetaEnabled: false,
    });
    core.addMembership({ storeId, userId: "user-disabled", role: "owner" });
    const workingApi = core.sellerApi({ userId: "user-disabled" });
    const listExpiryWatchlistV2 = jest.fn(workingApi.listExpiryWatchlistV2);
    const sellerApi: SellerStoreApiV2 = {
      ...workingApi,
      listExpiryWatchlistV2,
    };

    const screen = render(providerTree(sellerApi, <ExpiryV2Screen />));

    await waitFor(() =>
      expect(screen.getByTestId("expiry-v2-beta-disabled")).toBeTruthy()
    );
    expect(listExpiryWatchlistV2).not.toHaveBeenCalled();
  });

  it("discards a prior store response after the store id becomes unavailable", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    let resolveFirst!: (result: Result<ExpiryWatchItemV2[]>) => void;
    const firstRequest = new Promise<Result<ExpiryWatchItemV2[]>>((resolve) => {
      resolveFirst = resolve;
    });
    const sellerApi: SellerStoreApiV2 = {
      ...workingApi,
      listExpiryWatchlistV2: async () => firstRequest,
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      providerTree(sellerApi, children);
    const hook = renderHook(
      ({ storeId }: { storeId: string | null }) =>
        useExpiryWatchlistV2(storeId),
      {
        initialProps: { storeId: scenario.storeId as string | null },
        wrapper,
      }
    );

    await waitFor(() => expect(hook.result.current.status).toBe("loading"));
    hook.rerender({ storeId: null });
    await waitFor(() => expect(hook.result.current.status).toBe("idle"));

    await act(async () => {
      resolveFirst({
        ok: true,
        value: [
          {
            storeProductId: scenario.highConfidenceProductId,
            productName: "Stale product",
            expiryDate: "2026-08-12",
            daysToExpiry: 2,
            onHandQuantity: 10,
            confidence: "high",
            hasOpenExceptions: false,
            activeOfferId: null,
          },
        ],
      });
      await firstRequest;
    });

    expect(hook.result.current.status).toBe("idle");
    expect(hook.result.current.items).toEqual([]);
  });

  it("shows an honest empty state when no dated product is inside the window", async () => {
    const core = new InMemoryStoreCore();
    const storeId = core.createStore({
      name: "No expiry risk store",
      pilotModeEnabled: true,
      shopSellerBetaEnabled: true,
    });
    core.addMembership({ storeId, userId: "user-owner", role: "owner" });
    core.addProduct({
      storeId,
      productName: "Товар без даты",
      onHandQuantity: 5,
      confidence: "high",
      expiryDate: null,
    });
    core.addProduct({
      storeId,
      productName: "Дальний товар",
      onHandQuantity: 5,
      confidence: "high",
      expiryDate: "2026-08-25",
    });

    const screen = render(
      providerTree(core.sellerApi({ userId: "user-owner" }), <ExpiryV2Screen />)
    );

    await waitFor(() =>
      expect(screen.getByTestId("expiry-v2-empty-state")).toBeTruthy()
    );
    expect(screen.getByText("Нет товаров со сроком годности в ближайшие 14 дней")).toBeTruthy();
  });

  it("opens the watchlist from the inventory navigation entry", async () => {
    const world = makeWorld();
    const screen = render(
      providerTree(
        world.core.sellerApi({ userId: world.scenario.managerUserId }),
        <InventoryV2Screen />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId("inventory-v2-expiry-button")).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId("inventory-v2-expiry-button"));

    expect(mockPush).toHaveBeenLastCalledWith("/(seller-tabs)/expiry-v2");
  });
});
