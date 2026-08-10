/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import OffersV2Screen from "@/app/(seller-tabs)/offers-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { PublishOfferV2Input } from "@/lib/contracts";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

/**
 * Fix round 1, finding 7. Pause was unreachable once a seller left the
 * publish session that created the offer, listStoreOffersV2 (landed at
 * eb248ef) exists exactly to give this screen a way to find that offer
 * again.
 */

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
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

function publishInputFor(
  scenario: ReturnType<typeof makeDefaultScenario>,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    allergens: [],
    allocation: {
      physicallySetAside: false,
      quantity: 2,
      storeProductId: scenario.highConfidenceProductId,
    },
    cancellationPolicy: null,
    category: "bakery",
    contents: ["bread"],
    dietaryBadges: [],
    idempotencyKey: "publish-key-1",
    imageUrl: null,
    offerPriceUzs: 20000,
    pickupEnd: scenario.pickupEnd,
    pickupInstructions: null,
    pickupStart: scenario.pickupStart,
    referencePriceUzs: null,
    storeId: scenario.storeId,
    title: "Bakery rescue box",
    ...overrides,
  };
}

describe("Seller v2 store offers list", () => {
  it("lists every offer status including paused and expired, with the pickup window shown in Tashkent time", async () => {
    const { core, scenario } = makeWorld();
    const manager = core.sellerApi({ userId: scenario.managerUserId });

    // A short window that this test later advances the clock past, and the
    // scenario's own later window for the offers that must stay non
    // expired once that happens.
    const earlyStart = new Date(Date.parse(scenario.now) + 10 * 60000).toISOString();
    const earlyEnd = new Date(Date.parse(scenario.now) + 20 * 60000).toISOString();

    const live = await manager.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!live.ok) throw new Error("expected first publish to succeed");
    const toPause = await manager.approveAndPublishOfferV2(
      publishInputFor(scenario, { idempotencyKey: "publish-key-2", title: "Second box" })
    );
    if (!toPause.ok) throw new Error("expected second publish to succeed");
    await manager.pauseOfferV2({
      expectedVersion: toPause.value.version,
      idempotencyKey: "pause-key-existing",
      offerId: toPause.value.id,
      storeId: scenario.storeId,
    });
    const toExpire = await manager.approveAndPublishOfferV2(
      publishInputFor(scenario, {
        idempotencyKey: "publish-key-3",
        pickupEnd: earlyEnd,
        pickupStart: earlyStart,
        title: "Third box",
      })
    );
    if (!toExpire.ok) throw new Error("expected third publish to succeed");

    core.setNow(new Date(Date.parse(earlyEnd) + 60000).toISOString());

    const screen = render(providerTree(manager, <OffersV2Screen />));

    await waitFor(() => expect(screen.getByTestId(`offers-v2-row-${live.value.id}`)).toBeTruthy());
    expect(screen.getByTestId(`offers-v2-status-${live.value.id}`)).toHaveTextContent(
      "Live",
      { exact: false }
    );
    expect(screen.getByTestId(`offers-v2-status-${toPause.value.id}`)).toHaveTextContent(
      "Paused",
      { exact: false }
    );
    expect(screen.getByTestId(`offers-v2-status-${toExpire.value.id}`)).toHaveTextContent(
      "Expired",
      { exact: false }
    );
    // scenario.pickupStart "2026-08-10T17:00:00.000Z" is 22:00 in
    // Asia/Tashkent (UTC+05:00), five hours ahead of a naive UTC read.
    expect(
      screen.getByTestId(`offers-v2-pickup-window-${live.value.id}`)
    ).toHaveTextContent("22:00", { exact: false });
  });

  it("shows the honest empty state with no offers published", async () => {
    const { core, scenario } = makeWorld();
    const manager = core.sellerApi({ userId: scenario.managerUserId });

    const screen = render(providerTree(manager, <OffersV2Screen />));

    await waitFor(() => expect(screen.getByTestId("offers-v2-empty-state")).toBeTruthy());
  });

  it("shows an error state with a working retry when the offers fetch fails", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    let callCount = 0;
    const flakyApi: SellerStoreApiV2 = {
      ...workingApi,
      listStoreOffersV2: async (storeId) => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            error: { code: "network_error", message: "Offers offline", retryable: true },
          };
        }
        return workingApi.listStoreOffersV2(storeId);
      },
    };

    const screen = render(providerTree(flakyApi, <OffersV2Screen />));

    await waitFor(() => expect(screen.getByTestId("offers-v2-error-state")).toBeTruthy());
    expect(screen.getByText("Offers offline")).toBeTruthy();

    fireEvent.press(screen.getByTestId("offers-v2-retry-button"));

    await waitFor(() => expect(screen.queryByTestId("offers-v2-error-state")).toBeNull());
    expect(screen.getByTestId("offers-v2-empty-state")).toBeTruthy();
  });

  it("lets a manager pause a live offer and flips its status through the fake", async () => {
    const { core, scenario } = makeWorld();
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const published = await manager.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const screen = render(providerTree(manager, <OffersV2Screen />));
    await waitFor(() =>
      expect(screen.getByTestId(`offers-v2-pause-${published.value.id}`)).toBeTruthy()
    );

    fireEvent.press(screen.getByTestId(`offers-v2-pause-${published.value.id}`));

    await waitFor(() =>
      expect(screen.getByTestId(`offers-v2-status-${published.value.id}`)).toHaveTextContent(
        "Paused",
        { exact: false }
      )
    );
    expect(screen.queryByTestId(`offers-v2-pause-${published.value.id}`)).toBeNull();

    const fresh = await manager.listStoreOffersV2(scenario.storeId);
    if (!fresh.ok) throw new Error("expected offers read to succeed");
    expect(fresh.value.find((offer) => offer.id === published.value.id)?.status).toBe("paused");
  });

  it("shows an honest error when a pause call fails instead of pretending it worked", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const published = await workingApi.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const failingPauseApi: SellerStoreApiV2 = {
      ...workingApi,
      pauseOfferV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Pause offline", retryable: true },
      }),
    };

    const screen = render(providerTree(failingPauseApi, <OffersV2Screen />));
    await waitFor(() =>
      expect(screen.getByTestId(`offers-v2-pause-${published.value.id}`)).toBeTruthy()
    );

    fireEvent.press(screen.getByTestId(`offers-v2-pause-${published.value.id}`));

    await waitFor(() =>
      expect(
        screen.getByTestId(`offers-v2-pause-error-${published.value.id}`)
      ).toHaveTextContent("Pause offline")
    );
    expect(screen.getByTestId(`offers-v2-status-${published.value.id}`)).toHaveTextContent(
      "Live",
      { exact: false }
    );
    // The pause control stays available for a genuine retry.
    expect(screen.getByTestId(`offers-v2-pause-${published.value.id}`)).toBeTruthy();
  });

  it("never shows a pause control to staff", async () => {
    const { core, scenario } = makeWorld();
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const published = await manager.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const staff = core.sellerApi({ userId: scenario.staffUserId });
    const screen = render(providerTree(staff, <OffersV2Screen />));

    await waitFor(() =>
      expect(screen.getByTestId(`offers-v2-row-${published.value.id}`)).toBeTruthy()
    );
    expect(screen.queryByTestId(`offers-v2-pause-${published.value.id}`)).toBeNull();
  });
});
