"use client";

import { useLocale } from "@/lib/locale-store";
import { en } from "./en";
import { ru } from "./ru";
import type { Translations } from "./types";

const translations: Record<string, Translations> = { en, ru };

export function useT(): Translations {
  const locale = useLocale();
  return translations[locale] ?? en;
}

export type { Translations, Locale } from "./types";
