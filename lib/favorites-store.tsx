import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const STORAGE_KEY = "lastbite-favorites";

type FavoritesContextValue = {
  favorites: string[];
  isLoading: boolean;
  toggleFavorite: (offerId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!isMounted || !raw) {
          return;
        }

        try {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) {
            setFavorites(parsed);
          }
        } catch {
          setFavorites([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFavorite = useCallback(async (offerId: string) => {
    setFavorites((currentFavorites) => {
      const nextFavorites = currentFavorites.includes(offerId)
        ? currentFavorites.filter((id) => id !== offerId)
        : [...currentFavorites, offerId];

      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextFavorites));

      return nextFavorites;
    });
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      isLoading,
      toggleFavorite,
    }),
    [favorites, isLoading, toggleFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

function useFavoritesContext() {
  const value = useContext(FavoritesContext);

  if (!value) {
    throw new Error("FavoritesProvider is missing.");
  }

  return value;
}

export function useFavorites() {
  return useFavoritesContext().favorites;
}

export function useFavoritesLoading() {
  return useFavoritesContext().isLoading;
}

export function useToggleFavorite() {
  return useFavoritesContext().toggleFavorite;
}
