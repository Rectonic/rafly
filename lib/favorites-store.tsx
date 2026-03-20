import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lastbite-favorites';

interface FavoritesState {
  ids: string[];
  loaded: boolean;
}

type FavoritesAction =
  | { type: 'TOGGLE'; id: string }
  | { type: 'LOAD'; ids: string[] };

export function favoritesReducer(state: FavoritesState, action: FavoritesAction): FavoritesState {
  switch (action.type) {
    case 'TOGGLE':
      return {
        ...state,
        ids: state.ids.includes(action.id)
          ? state.ids.filter((id) => id !== action.id)
          : [...state.ids, action.id],
      };
    case 'LOAD':
      return { ids: action.ids, loaded: true };
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
  const [state, dispatch] = useReducer(favoritesReducer, { ids: [], loaded: false });

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        try {
          const ids = stored ? JSON.parse(stored) : [];
          dispatch({ type: 'LOAD', ids: Array.isArray(ids) ? ids : [] });
        } catch {
          dispatch({ type: 'LOAD', ids: [] });
        }
      })
      .catch(() => {
        dispatch({ type: 'LOAD', ids: [] });
      });
  }, []);

  // Write to AsyncStorage only after loading completes (avoids overwriting on mount)
  useEffect(() => {
    if (state.loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
    }
  }, [state.ids, state.loaded]);

  const toggleFavorite = React.useCallback((id: string) => {
    dispatch({ type: 'TOGGLE', id });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites: state.ids, toggleFavorite }}>
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
