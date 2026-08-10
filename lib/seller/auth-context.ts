import { createContext, useContext } from "react";

import type { SellerAuthContextValue } from "@/lib/seller/auth-store";

export const SellerAuthContext = createContext<SellerAuthContextValue | null>(
  null
);

export function useOptionalSellerAuth() {
  return useContext(SellerAuthContext);
}
