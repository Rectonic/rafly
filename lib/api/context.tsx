import { createContext, useContext, type PropsWithChildren } from "react";

import type { BuyerMarketplaceApiV2 } from "@/lib/api/buyer-api";
import type { SellerStoreApiV2 } from "@/lib/api/seller-api";

export interface ApiContextValue {
  buyerApi: BuyerMarketplaceApiV2;
  sellerApi: SellerStoreApiV2;
}

export const ApiContext = createContext<ApiContextValue | null>(null);

export type ApiProviderProps = PropsWithChildren<ApiContextValue>;

export function ApiProvider({ buyerApi, sellerApi, children }: ApiProviderProps) {
  return (
    <ApiContext.Provider value={{ buyerApi, sellerApi }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useBuyerApi(): BuyerMarketplaceApiV2 {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("ApiProvider missing");
  }
  return context.buyerApi;
}

export function useSellerApi(): SellerStoreApiV2 {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("ApiProvider missing");
  }
  return context.sellerApi;
}
