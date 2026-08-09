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

import type { Locale } from "@/i18n/types";

const STORAGE_KEY = "lastbite-locale";
const DEFAULT_LOCALE: Locale = "ru";

type LocaleContextValue = {
  isLoading: boolean;
  locale: Locale;
  setLocale: (nextLocale: Locale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedLocale) => {
        if (!isMounted) {
          return;
        }

        if (storedLocale === "en" || storedLocale === "ru") {
          setLocaleState(storedLocale);
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

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    await AsyncStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      locale,
      setLocale,
    }),
    [isLoading, locale, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocaleContext() {
  const value = useContext(LocaleContext);

  if (!value) {
    throw new Error("LocaleProvider is missing.");
  }

  return value;
}

export function useLocale() {
  return useLocaleContext().locale;
}

export function useLocaleLoading() {
  return useLocaleContext().isLoading;
}

export function useSetLocale() {
  return useLocaleContext().setLocale;
}
