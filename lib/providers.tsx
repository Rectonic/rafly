import type { PropsWithChildren } from "react";

import { FavoritesProvider } from "@/lib/favorites-store";
import { LocaleProvider } from "@/lib/locale-store";
import { MarketplaceProvider } from "@/lib/marketplace-store";
import { ReservationHistoryProvider } from "@/lib/reservations-store";
import { SearchProvider } from "@/lib/search-store";
import { AuthProvider } from "@/lib/seller/auth-store";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AuthProvider>
        <FavoritesProvider>
          <SearchProvider>
            <ReservationHistoryProvider>
              <MarketplaceProvider>{children}</MarketplaceProvider>
            </ReservationHistoryProvider>
          </SearchProvider>
        </FavoritesProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
