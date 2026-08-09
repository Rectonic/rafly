import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

type SearchContextValue = {
  query: string;
  setQuery: (nextQuery: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: PropsWithChildren) {
  const [query, setQuery] = useState("");

  const value = useMemo(
    () => ({
      query,
      setQuery,
    }),
    [query]
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

function useSearchContext() {
  const value = useContext(SearchContext);

  if (!value) {
    throw new Error("SearchProvider is missing.");
  }

  return value;
}

export function useSearchQuery() {
  return useSearchContext().query;
}

export function useSetSearchQuery() {
  return useSearchContext().setQuery;
}
