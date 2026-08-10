import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import { ExceptionsPanelV2 } from "@/components/seller/ExceptionsPanelV2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { MarketplaceOfferV2 } from "@/lib/contracts";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => jest.fn(),
}));

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  const buyerApiStub = {} as never;
  return (
    <ApiProvider buyerApi={buyerApiStub} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

async function makeMismatchWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const manager = core.sellerApi({ userId: scenario.managerUserId });
  const published = await manager.approveAndPublishOfferV2({
    storeId: scenario.storeId,
    idempotencyKey: "exceptions-panel-publish",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 3,
      physicallySetAside: false,
    },
    title: "Exception panel rescue box",
    category: "bakery",
    imageUrl: null,
    contents: ["bread"],
    offerPriceUzs: 20000,
    referencePriceUzs: 50000,
    pickupStart: scenario.pickupStart,
    pickupEnd: scenario.pickupEnd,
    allergens: [],
    dietaryBadges: [],
    pickupInstructions: null,
    cancellationPolicy: null,
  });
  if (!published.ok) {
    throw new Error("expected the exception panel offer to publish");
  }

  const offer = published.value;
  const buyer = core.buyerApi();
  const first = await buyer.reserveOfferV2({
    offerId: offer.id,
    quantity: 1,
    clientReservationId: "exceptions-panel-reservation-1",
    installationId: scenario.installationA,
    expectedOfferVersion: offer.version,
  });
  if (!first.ok) {
    throw new Error("expected the first exception panel reservation");
  }
  const second = await buyer.reserveOfferV2({
    offerId: offer.id,
    quantity: 1,
    clientReservationId: "exceptions-panel-reservation-2",
    installationId: scenario.installationB,
    expectedOfferVersion: offer.version + 1,
  });
  if (!second.ok) {
    throw new Error("expected the second exception panel reservation");
  }

  const mismatch = await manager.reportStockMismatchV2({
    storeId: scenario.storeId,
    offerId: offer.id,
    observedQuantity: 0,
    reason: "reserved bags were missing",
    idempotencyKey: "exceptions-panel-mismatch",
  });
  if (!mismatch.ok) {
    throw new Error("expected the exception panel mismatch");
  }

  return {
    core,
    exceptionId: mismatch.value.exception.id,
    manager,
    scenario,
  };
}

function findProductMax(
  rows: Awaited<ReturnType<SellerStoreApiV2["listStoreInventoryV2"]>>,
  storeProductId: string
): number {
  if (!rows.ok) {
    throw new Error("expected inventory rows");
  }
  const row = rows.value.find((item) => item.storeProductId === storeProductId);
  if (!row) {
    throw new Error("expected inventory product row");
  }
  return row.maxOfferableQuantity;
}

describe("ExceptionsPanelV2", () => {
  it("uses release copy only for stock mismatch exceptions", async () => {
    const { exceptionId, manager, scenario } = await makeMismatchWorld();
    const listed = await manager.listStoreExceptionsV2(scenario.storeId);
    if (!listed.ok) throw new Error("expected exception list");
    const stockMismatch = listed.value.find((entry) => entry.id === exceptionId);
    if (!stockMismatch) throw new Error("expected stock mismatch");
    const mixedApi: SellerStoreApiV2 = {
      ...manager,
      listStoreExceptionsV2: async () => ({
        ok: true,
        value: [
          stockMismatch,
          {
            ...stockMismatch,
            id: "expiry-risk-copy",
            kind: "expiry_risk",
            message: "expiry review needed",
            relatedOfferId: null,
          },
        ],
      }),
    };
    const screen = render(
      providerTree(
        mixedApi,
        <ExceptionsPanelV2 canResolve storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`));
    expect(screen.getByTestId(`exceptions-panel-v2-submit-${exceptionId}`)).toHaveTextContent(
      "Resolve and release units"
    );
    fireEvent.press(screen.getByTestId("exceptions-panel-v2-resolve-expiry-risk-copy"));
    expect(screen.getByTestId("exceptions-panel-v2-submit-expiry-risk-copy")).toHaveTextContent(
      "Resolve exception"
    );
  });

  it("shows the exception to staff without any resolve control", async () => {
    const { core, exceptionId, scenario } = await makeMismatchWorld();
    const staff = core.sellerApi({ userId: scenario.staffUserId });

    const screen = render(
      providerTree(
        staff,
        <ExceptionsPanelV2 canResolve={false} storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-card-${exceptionId}`)).toBeTruthy()
    );
    expect(
      screen.queryByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)
    ).toBeNull();
  });

  it("lets a manager resolve an exception with a required note", async () => {
    const { exceptionId, manager, scenario } = await makeMismatchWorld();
    const screen = render(
      providerTree(
        manager,
        <ExceptionsPanelV2 canResolve storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`));
    fireEvent.changeText(
      screen.getByTestId(`exceptions-panel-v2-note-${exceptionId}`),
      "Shelf recounted and the missing bags were located"
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-submit-${exceptionId}`));

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolved-${exceptionId}`)).toBeTruthy()
    );
    const listed = await manager.listStoreExceptionsV2(scenario.storeId);
    if (!listed.ok) {
      throw new Error("expected resolved exception list");
    }
    expect(listed.value[0]).toMatchObject({
      id: exceptionId,
      status: "resolved",
      resolutionNote: "Shelf recounted and the missing bags were located",
    });
  });

  it("blocks an empty note before calling the facade", async () => {
    const { exceptionId, manager, scenario } = await makeMismatchWorld();
    const resolveSpy = jest.spyOn(manager, "resolveStoreExceptionV2");
    const screen = render(
      providerTree(
        manager,
        <ExceptionsPanelV2 canResolve storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`));
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-submit-${exceptionId}`));

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(`exceptions-panel-v2-note-required-${exceptionId}`)
    ).toBeTruthy();
  });

  it("surfaces a facade error without marking the exception resolved", async () => {
    const { exceptionId, manager, scenario } = await makeMismatchWorld();
    const failingApi: SellerStoreApiV2 = {
      ...manager,
      resolveStoreExceptionV2: async () => ({
        ok: false,
        error: {
          code: "network_error",
          message: "offline",
          retryable: true,
        },
      }),
    };
    const screen = render(
      providerTree(
        failingApi,
        <ExceptionsPanelV2 canResolve storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`));
    fireEvent.changeText(
      screen.getByTestId(`exceptions-panel-v2-note-${exceptionId}`),
      "Recount completed"
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-submit-${exceptionId}`));

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-error-${exceptionId}`)).toBeTruthy()
    );
    expect(
      screen.queryByTestId(`exceptions-panel-v2-resolved-${exceptionId}`)
    ).toBeNull();
  });

  it("releases failed mismatch units back into the fake inventory ceiling", async () => {
    const { exceptionId, manager, scenario } = await makeMismatchWorld();
    const before = findProductMax(
      await manager.listStoreInventoryV2(scenario.storeId),
      scenario.highConfidenceProductId
    );
    const screen = render(
      providerTree(
        manager,
        <ExceptionsPanelV2 canResolve storeId={scenario.storeId} />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-resolve-${exceptionId}`));
    fireEvent.changeText(
      screen.getByTestId(`exceptions-panel-v2-note-${exceptionId}`),
      "Located both failed reservation units"
    );
    fireEvent.press(screen.getByTestId(`exceptions-panel-v2-submit-${exceptionId}`));
    await waitFor(() =>
      expect(screen.getByTestId(`exceptions-panel-v2-resolved-${exceptionId}`)).toBeTruthy()
    );

    const after = findProductMax(
      await manager.listStoreInventoryV2(scenario.storeId),
      scenario.highConfidenceProductId
    );
    expect(after).toBe(before + 2);

    const publishAtRecoveredCeiling: MarketplaceOfferV2 | null = await manager
      .approveAndPublishOfferV2({
        storeId: scenario.storeId,
        idempotencyKey: "exceptions-panel-recovered-publish",
        allocation: {
          storeProductId: scenario.highConfidenceProductId,
          quantity: after,
          physicallySetAside: false,
        },
        title: "Recovered ceiling offer",
        category: "bakery",
        imageUrl: null,
        contents: ["bread"],
        offerPriceUzs: 20000,
        referencePriceUzs: 50000,
        pickupStart: scenario.pickupStart,
        pickupEnd: scenario.pickupEnd,
        allergens: [],
        dietaryBadges: [],
        pickupInstructions: null,
        cancellationPolicy: null,
      })
      .then((result) => (result.ok ? result.value : null));
    expect(publishAtRecoveredCeiling).not.toBeNull();
  });
});
