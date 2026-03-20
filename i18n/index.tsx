import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Locale, MobileTranslations } from './types';
import { en } from './en';
import { ru } from './ru';

const DICTIONARIES: Record<Locale, MobileTranslations> = { en, ru };
const STORAGE_KEY = 'lastbite-locale';
const DEFAULT_LOCALE: Locale = 'ru'; // intentionally Russian for Tashkent users

interface LocaleState {
  locale: Locale;
  t: MobileTranslations;
  loaded: boolean;
}

type LocaleAction =
  | { type: 'SET_LOCALE'; locale: Locale }
  | { type: 'LOADED'; locale: Locale };

function localeReducer(state: LocaleState, action: LocaleAction): LocaleState {
  switch (action.type) {
    case 'SET_LOCALE':
      return { locale: action.locale, t: DICTIONARIES[action.locale], loaded: true };
    case 'LOADED':
      return { locale: action.locale, t: DICTIONARIES[action.locale], loaded: true };
    default:
      return state;
  }
}

interface LocaleContextValue {
  locale: Locale;
  t: MobileTranslations;
  setLocale: (locale: Locale) => Promise<void>;
  loaded: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(localeReducer, {
    locale: DEFAULT_LOCALE,
    t: DICTIONARIES[DEFAULT_LOCALE],
    loaded: false,
  });

  // Load persisted locale on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const locale = (stored === 'en' || stored === 'ru') ? stored : DEFAULT_LOCALE;
        dispatch({ type: 'LOADED', locale });
      })
      .catch(() => {
        dispatch({ type: 'LOADED', locale: DEFAULT_LOCALE });
      });
  }, []);

  const setLocale = async (locale: Locale) => {
    dispatch({ type: 'SET_LOCALE', locale });
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  };

  return (
    <LocaleContext.Provider value={{ ...state, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useT(): MobileTranslations {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useT must be used inside LocaleProvider');
  return ctx.t;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => Promise<void>; loaded: boolean } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return { locale: ctx.locale, setLocale: ctx.setLocale, loaded: ctx.loaded };
}
