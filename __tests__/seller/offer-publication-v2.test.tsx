/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import PublishV2Screen from "@/app/(seller-tabs)/publish-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { MarketplaceOfferV2, PublishOfferV2Input, Result } from "@/lib/contracts";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";
import { usePublishOfferV2 } from "@/lib/seller/publish-v2";

/**
 * Sequence 4, offer publication. Publishing is manager and owner only, it
 * is never automatic, every allocation ties to real inventory, low and
 * medium confidence stock requires an explicit physical set aside, expired
 * stock cannot publish no matter how it got selected, and the offer shown
 * on screen is always the backend's own confirmed result rather than
 * anything assembled locally from the draft.
 */

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
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

function basePublishInput(scenario: ReturnType<typeof makeDefaultScenario>) {
  return {
    allergens: ["gluten"],
    allocation: {
      physicallySetAside: false,
      quantity: 2,
      storeProductId: scenario.highConfidenceProductId,
    },
    cancellationPolicy: "Cancel before pickup start",
    category: "bakery",
    contents: ["bread", "pastry"],
    dietaryBadges: ["vegetarian"],
    imageUrl: null,
    offerPriceUzs: 20000,
    pickupEnd: scenario.pickupEnd,
    pickupInstructions: "Ask at the counter",
    pickupStart: scenario.pickupStart,
    referencePriceUzs: 50000,
    title: "Bakery rescue box",
  };
}

describe("Seller v2 offer publication", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("usePublishOfferV2", () => {
    it("publishes through the manager api and returns the backend's authoritative offer", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

      const { result } = renderHook(() => usePublishOfferV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await act(async () => {
        await result.current.publish(basePublishInput(scenario));
      });

      expect(result.current.status).toBe("published");
      expect(result.current.offer?.status).toBe("live");
      expect(result.current.offer?.quantityAvailable).toBe(2);
    });

    it("reuses one idempotency key across a retry after a failed attempt", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.managerUserId });
      const seenKeys: string[] = [];
      let attempt = 0;
      const flakyApi: SellerStoreApiV2 = {
        ...workingApi,
        approveAndPublishOfferV2: async (input) => {
          attempt += 1;
          seenKeys.push(input.idempotencyKey);
          if (attempt === 1) {
            return {
              ok: false,
              error: { code: "network_error", message: "offline", retryable: true },
            };
          }
          return workingApi.approveAndPublishOfferV2(input);
        },
      };

      const { result } = renderHook(() => usePublishOfferV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(flakyApi, children),
      });

      await act(async () => {
        await result.current.publish(basePublishInput(scenario));
      });
      expect(result.current.status).toBe("error");

      await act(async () => {
        await result.current.publish(basePublishInput(scenario));
      });
      expect(result.current.status).toBe("published");

      expect(seenKeys).toHaveLength(2);
      expect(seenKeys[0]).toBe(seenKeys[1]);
    });

    it("never sets the offer before the backend confirms it", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.managerUserId });
      let resolvePublish: ((value: Result<MarketplaceOfferV2>) => void) | null = null;
      const delayedApi: SellerStoreApiV2 = {
        ...workingApi,
        approveAndPublishOfferV2: () =>
          new Promise((resolve) => {
            resolvePublish = resolve;
          }),
      };

      const { result } = renderHook(() => usePublishOfferV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(delayedApi, children),
      });

      let publishPromise: Promise<Result<MarketplaceOfferV2> | null> | null = null;
      act(() => {
        publishPromise = result.current.publish(basePublishInput(scenario));
      });

      expect(result.current.status).toBe("submitting");
      expect(result.current.offer).toBeNull();

      await act(async () => {
        resolvePublish?.(
          await workingApi.approveAndPublishOfferV2({
            ...basePublishInput(scenario),
            idempotencyKey: "resolved-key",
            storeId: scenario.storeId,
          } as PublishOfferV2Input)
        );
        await publishPromise;
      });

      expect(result.current.status).toBe("published");
      expect(result.current.offer?.status).toBe("live");
    });

    it("pauses idempotently, a repeated pause call replays the same result", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

      const { result } = renderHook(() => usePublishOfferV2(scenario.storeId), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await act(async () => {
        await result.current.publish(basePublishInput(scenario));
      });

      const first = await act(async () => result.current.pause());
      const second = await act(async () => result.current.pause());

      expect(first?.ok).toBe(true);
      expect(second?.ok).toBe(true);
      expect(second).toEqual(first);
      expect(result.current.pauseStatus).toBe("paused");
    });
  });

  describe("PublishV2Screen", () => {
    it("lists only eligible inventory, excluding a high confidence product with nothing left to offer", async () => {
      const { core, scenario } = makeWorld();
      const depletedProductId = core.addProduct({
        confidence: "high",
        onHandQuantity: 0,
        productName: "Sold out crate",
        storeId: scenario.storeId,
      });
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));

      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );
      expect(
        screen.getByTestId(`publish-v2-product-${scenario.lowConfidenceProductId}`)
      ).toBeTruthy();
      expect(screen.queryByTestId(`publish-v2-product-${depletedProductId}`)).toBeNull();
    });

    it("blocks review when quantity exceeds the safe maximum for a high confidence product", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "11");

      expect(screen.getByTestId("publish-v2-quantity-exceeds-max-hint")).toBeTruthy();

      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      expect(screen.queryByTestId("publish-v2-review-panel")).toBeNull();

      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "10");
      expect(screen.queryByTestId("publish-v2-quantity-exceeds-max-hint")).toBeNull();
    });

    it("requires an explicit physical set aside confirmation before a low confidence product can be reviewed", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.lowConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.lowConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "3");

      expect(screen.getByTestId("publish-v2-set-aside-required-hint")).toBeTruthy();
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      expect(screen.queryByTestId("publish-v2-review-panel")).toBeNull();

      fireEvent.press(screen.getByTestId("publish-v2-physical-set-aside-toggle"));
      expect(screen.queryByTestId("publish-v2-set-aside-required-hint")).toBeNull();
    });

    it("blocks review when the pickup window is not ordered correctly", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupEnd
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupStart
      );

      expect(screen.getByTestId("publish-v2-pickup-window-invalid-hint")).toBeTruthy();
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      expect(screen.queryByTestId("publish-v2-review-panel")).toBeNull();
    });

    it("fix round 1, finding 2: blocks review with an empty category instead of silently defaulting it", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      // Category left blank on purpose.

      expect(screen.getByTestId("publish-v2-category-required-hint")).toBeTruthy();
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      expect(screen.queryByTestId("publish-v2-review-panel")).toBeNull();

      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      expect(screen.queryByTestId("publish-v2-category-required-hint")).toBeNull();
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
    });

    it("shows a complete review sourced from the entered fields before any approval, including contents, allergens, dietary badges, and category", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(screen.getByTestId("publish-v2-reference-price-input"), "50000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-contents-input"),
        "Sourdough loaf\nCinnamon roll"
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-allergens-input"), "Gluten\nDairy");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-dietary-badges-input"),
        "Vegetarian"
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );

      fireEvent.press(screen.getByTestId("publish-v2-review-button"));

      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      expect(screen.getByTestId("publish-v2-review-quantity")).toHaveTextContent("2", {
        exact: false,
      });
      expect(screen.getByTestId("publish-v2-review-price")).toHaveTextContent("20000", {
        exact: false,
      });
      expect(screen.getByTestId("publish-v2-review-category")).toHaveTextContent("bakery", {
        exact: false,
      });
      expect(screen.getByTestId("publish-v2-review-contents")).toHaveTextContent(
        "Sourdough loaf",
        { exact: false }
      );
      expect(screen.getByTestId("publish-v2-review-contents")).toHaveTextContent(
        "Cinnamon roll",
        { exact: false }
      );
      expect(screen.getByTestId("publish-v2-review-allergens")).toHaveTextContent("Gluten", {
        exact: false,
      });
      expect(screen.getByTestId("publish-v2-review-dietary-badges")).toHaveTextContent(
        "Vegetarian",
        { exact: false }
      );
      expect(screen.queryByTestId("publish-v2-published-panel")).toBeNull();

      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));
      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-published-panel")).toBeTruthy()
      );
    });

    it("shows the backend confirmed discount with a reference price and no discount without one", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(screen.getByTestId("publish-v2-reference-price-input"), "50000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));

      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-published-discount")).toHaveTextContent("60", {
          exact: false,
        })
      );

      // A second offer without a reference price shows no discount. The
      // readiness check below waits on the high confidence product rather
      // than the scenario's already expired fixture, that fixture no
      // longer appears in the picker at all once expired products are
      // excluded client side (finding 6).
      const secondScreen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          secondScreen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );
      fireEvent.press(
        secondScreen.getByTestId(`publish-v2-product-${scenario.lowConfidenceProductId}`)
      );
      fireEvent.changeText(secondScreen.getByTestId("publish-v2-quantity-input"), "1");
      fireEvent.press(secondScreen.getByTestId("publish-v2-physical-set-aside-toggle"));
      fireEvent.changeText(
        secondScreen.getByTestId("publish-v2-title-input"),
        "Dairy clearance"
      );
      fireEvent.changeText(secondScreen.getByTestId("publish-v2-category-input"), "dairy");
      fireEvent.changeText(secondScreen.getByTestId("publish-v2-price-input"), "9000");
      fireEvent.changeText(
        secondScreen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        secondScreen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      fireEvent.press(secondScreen.getByTestId("publish-v2-review-button"));
      await waitFor(() =>
        expect(secondScreen.getByTestId("publish-v2-review-panel")).toBeTruthy()
      );
      fireEvent.press(secondScreen.getByTestId("publish-v2-confirm-button"));

      await waitFor(() =>
        expect(secondScreen.getByTestId("publish-v2-published-no-discount")).toBeTruthy()
      );
    });

    it("fix round 1, finding 6: excludes a product whose expiry date has already passed from the eligible picker", async () => {
      const { core, scenario } = makeWorld();
      const longPastProductId = core.addProduct({
        confidence: "high",
        expiryDate: "2020-01-01",
        onHandQuantity: 4,
        productName: "Ancient batch",
        storeId: scenario.storeId,
      });
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));

      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );
      expect(screen.queryByTestId(`publish-v2-product-${longPastProductId}`)).toBeNull();
    });

    it("fix round 1, finding 6: shows expiry date on the eligible picker rows that carry one", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));

      // lib/test-kit/scenarios.ts seeds the high confidence fixture with a
      // fixed "2026-08-12" expiry date, asserted directly since
      // DefaultScenario does not expose it as a named field.
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toHaveTextContent("2026-08-12", { exact: false })
      );
    });

    it("still surfaces the backend's own expired rejection honestly for a product that passed the client side check", async () => {
      // A client side filter is a convenience, not the authority. This
      // fixture's expiry date is safely in the future relative to the real
      // wall clock (so it stays eligible in the picker) and the pickup
      // window is further out still (so the window validation stays
      // satisfied), the backend's own clock is then advanced to a point
      // after the expiry date but before the pickup window with setNow, so
      // the publish attempt hits the same validation_failed rejection a
      // truly expired product would, proving the backend check is never
      // skipped just because a client side filter also exists.
      const { core, scenario } = makeWorld();
      const laterExpiringId = core.addProduct({
        confidence: "high",
        expiryDate: "2030-01-01",
        onHandQuantity: 4,
        productName: "Will expire on the backend clock",
        storeId: scenario.storeId,
      });
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(screen.getByTestId(`publish-v2-product-${laterExpiringId}`)).toBeTruthy()
      );

      fireEvent.press(screen.getByTestId(`publish-v2-product-${laterExpiringId}`));
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Day old pastries");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "5000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        "2031-01-01T09:00:00.000Z"
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        "2031-01-01T12:00:00.000Z"
      );
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());

      core.setNow("2030-06-01T09:00:00.000Z");
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));

      await waitFor(() => expect(screen.getByTestId("publish-v2-publish-error")).toBeTruthy());
      expect(screen.getByText(/expired/)).toBeTruthy();
      expect(screen.queryByTestId("publish-v2-published-panel")).toBeNull();
    });

    it("shows an idempotent pause action once the offer is live", async () => {
      const { core, scenario } = makeWorld();
      const manager = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(manager, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));

      await waitFor(() => expect(screen.getByTestId("publish-v2-pause-button")).toBeTruthy());

      fireEvent.press(screen.getByTestId("publish-v2-pause-button"));
      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-paused-label")).toBeTruthy()
      );
      // Once paused the screen replaces the action with a plain label
      // instead of leaving a redundant control mounted, the underlying
      // safety of a repeated pause call itself is proven at the hook level
      // in "pauses idempotently, a repeated pause call replays the same
      // result" above.
      expect(screen.queryByTestId("publish-v2-pause-button")).toBeNull();
    });

    it("fix round 1, finding 5: rotates the idempotency key after Back to edit changes the draft", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.managerUserId });
      const seenKeys: string[] = [];
      let attempt = 0;
      const flakyFirstApi: SellerStoreApiV2 = {
        ...workingApi,
        approveAndPublishOfferV2: async (input) => {
          attempt += 1;
          seenKeys.push(input.idempotencyKey);
          if (attempt === 1) {
            return {
              ok: false,
              error: { code: "network_error", message: "offline", retryable: true },
            };
          }
          return workingApi.approveAndPublishOfferV2(input);
        },
      };

      const screen = render(providerTree(flakyFirstApi, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-publish-error")).toBeTruthy());

      fireEvent.press(screen.getByTestId("publish-v2-back-button"));
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "18000");
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));

      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-published-panel")).toBeTruthy()
      );
      expect(seenKeys).toHaveLength(2);
      expect(seenKeys[0]).not.toBe(seenKeys[1]);
    });

    it("fix round 1, finding 4: shows an honest error when pausing fails instead of pretending it worked", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.managerUserId });
      const failingPauseApi: SellerStoreApiV2 = {
        ...workingApi,
        pauseOfferV2: async () => ({
          ok: false,
          error: { code: "network_error", message: "Pause offline", retryable: true },
        }),
      };

      const screen = render(providerTree(failingPauseApi, <PublishV2Screen />));
      await waitFor(() =>
        expect(
          screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
        ).toBeTruthy()
      );

      fireEvent.press(
        screen.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      );
      fireEvent.changeText(screen.getByTestId("publish-v2-quantity-input"), "2");
      fireEvent.changeText(screen.getByTestId("publish-v2-title-input"), "Bakery rescue box");
      fireEvent.changeText(screen.getByTestId("publish-v2-category-input"), "bakery");
      fireEvent.changeText(screen.getByTestId("publish-v2-price-input"), "20000");
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-start-input"),
        scenario.pickupStart
      );
      fireEvent.changeText(
        screen.getByTestId("publish-v2-pickup-end-input"),
        scenario.pickupEnd
      );
      fireEvent.press(screen.getByTestId("publish-v2-review-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-review-panel")).toBeTruthy());
      fireEvent.press(screen.getByTestId("publish-v2-confirm-button"));
      await waitFor(() => expect(screen.getByTestId("publish-v2-pause-button")).toBeTruthy());

      fireEvent.press(screen.getByTestId("publish-v2-pause-button"));

      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-pause-error")).toHaveTextContent("Pause offline")
      );
      expect(screen.queryByTestId("publish-v2-paused-label")).toBeNull();
      // The pause control stays available for a genuine retry.
      expect(screen.getByTestId("publish-v2-pause-button")).toBeTruthy();
    });

    it("denies the publish screen to staff", async () => {
      const { core, scenario } = makeWorld();
      const staff = core.sellerApi({ userId: scenario.staffUserId });

      const screen = render(providerTree(staff, <PublishV2Screen />));

      await waitFor(() =>
        expect(screen.getByTestId("publish-v2-forbidden-state")).toBeTruthy()
      );
      expect(
        screen.queryByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      ).toBeNull();
    });
  });
});
