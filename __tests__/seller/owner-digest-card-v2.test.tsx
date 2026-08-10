import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import { OwnerDigestCardV2 } from "@/components/seller/OwnerDigestCardV2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

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

describe("OwnerDigestCardV2", () => {
  it("lets a manager request the digest and renders selectable share-ready text", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const compose = jest.spyOn(manager, "composeOwnerDigestV2");
    const screen = render(providerTree(manager, <OwnerDigestCardV2 />));

    await waitFor(() =>
      expect(screen.getByTestId("owner-digest-v2-compose-button")).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId("owner-digest-v2-compose-button"));

    await waitFor(() =>
      expect(screen.getByTestId("owner-digest-v2-share-text")).toHaveTextContent(
        new RegExp(`Сводка дня: ${scenario.storeName}`)
      )
    );
    expect(compose).toHaveBeenCalledWith(scenario.storeId);
    expect(screen.getByTestId("owner-digest-v2-share-text")).toHaveTextContent(
      /Давно не проверялось/
    );
    expect(screen.getByText(/нажмите и удерживайте.*копировать/i)).toBeTruthy();
    expect(
      screen.getByTestId("owner-digest-v2-share-text").props.selectable
    ).toBe(true);
  });

  it("stays hidden from staff even though staff has general beta access", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const staff = core.sellerApi({ userId: scenario.staffUserId });
    const screen = render(providerTree(staff, <OwnerDigestCardV2 />));

    await waitFor(() =>
      expect(screen.queryByTestId("owner-digest-v2-card")).toBeNull()
    );
    expect(screen.queryByText("сводка дня")).toBeNull();
  });
});
