import { fireEvent, render } from "@testing-library/react-native";

import { InventoryCard } from "@/components/seller/InventoryCard";
import type { InventoryItem } from "@/types/seller";

const mockDelete = jest.fn();
let mockLocale: "en" | "ru" = "ru";

const baseItem: InventoryItem = {
  barcode: "4601234567890",
  createdAt: "2026-05-28T00:00:00.000Z",
  expiryDate: "2026-06-01",
  id: "item-1",
  productName: "Йогурт",
  quantity: 3,
  sellerId: "seller-1",
  source: "manual",
};

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

describe("InventoryCard localization", () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockLocale = "ru";
  });

  it("renders stock metadata and delete action in Russian", () => {
    const screen = render(
      <InventoryCard item={baseItem} onDelete={mockDelete} />
    );

    expect(screen.getByText("Штрих-код 4601234567890")).toBeTruthy();
    expect(screen.getByText("Кол-во: 3")).toBeTruthy();
    fireEvent.press(screen.getByText("Удалить"));

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Delete")).toBeNull();
    expect(screen.queryByText("Qty 3")).toBeNull();
  });

  it("renders manual-entry metadata in English", () => {
    mockLocale = "en";

    const screen = render(
      <InventoryCard
        item={{
          ...baseItem,
          barcode: "",
        }}
        onDelete={mockDelete}
      />
    );

    expect(screen.getByText("Manual entry")).toBeTruthy();
    expect(screen.getByText("Qty 3")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });
});
