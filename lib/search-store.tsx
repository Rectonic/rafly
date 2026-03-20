import React, { createContext, useContext, useReducer } from 'react';

type SearchAction = { type: 'SET'; query: string };

function searchReducer(_: string, action: SearchAction): string {
  return action.type === 'SET' ? action.query : _;
}

interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, dispatch] = useReducer(searchReducer, '');
  const setSearchQuery = React.useCallback((q: string) => dispatch({ type: 'SET', query: q }), []);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchQuery(): string {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchQuery must be inside SearchProvider');
  return ctx.searchQuery;
}

export function useSetSearchQuery(): (q: string) => void {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSetSearchQuery must be inside SearchProvider');
  return ctx.setSearchQuery;
}
