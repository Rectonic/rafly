import { getSellerTabVisibility } from "@/lib/seller/tab-visibility";

describe("getSellerTabVisibility", () => {
  it("shows restaurant create tab and hides inventory", () => {
    expect(getSellerTabVisibility("restaurant")).toEqual({
      create: true,
      inventory: false,
    });
  });

  it("shows shop inventory tab and hides create", () => {
    expect(getSellerTabVisibility("shop")).toEqual({
      create: false,
      inventory: true,
    });
  });
});
