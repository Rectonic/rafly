import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lastbite-favorites';

type FavoritesAction =
  | { type: 'TOGGLE'; id: string }
  | { type: 'LOAD'; ids: string[] };

export function favoritesReducer(state: string[], action: FavoritesAction): string[] {
  switch (action.type) {
    case 'TOGGLE':
      return state.includes(action.id)
        ? state.filter((id) => id !== action.id)
        : [...state, action.id];
    case 'LOAD':
      return action.ids;
    default:
      return state;
  }
}

interface FavoritesContextValue {
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, dispatch] = useReducer(favoritesReducer, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      try {
        const ids = stored ? JSON.parse(stored) : [];
        dispatch({ type: 'LOAD', ids: Array.isArray(ids) ? ids : [] });
      } catch {
        dispatch({ type: 'LOAD', ids: [] });
      }
    });
  }, []);

  const toggleFavorite = (id: string) => {
    dispatch({ type: 'TOGGLE', id });
  };

  // Write to AsyncStorage whenever favorites state changes (avoids stale closure)
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): string[] {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be inside FavoritesProvider');
  return ctx.favorites;
}

export function useToggleFavorite(): (id: string) => void {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useToggleFavorite must be inside FavoritesProvider');
  return ctx.toggleFavorite;
}
