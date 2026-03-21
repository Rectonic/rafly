"use client";

import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/types";

const STORAGE_KEY = "lastbite-locale";
const CHANGE_EVENT = "lastbite-locale-change";
const DEFAULT_LOCALE: Locale = "en";

function canUseDOM() {
  return typeof window !== "undefined";
}

function readLocale(): Locale {
  if (!canUseDOM()) return DEFAULT_LOCALE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "ru" || raw === "en") return raw;
  return DEFAULT_LOCALE;
}

function writeLocale(locale: Locale) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  if (!canUseDOM()) return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function getServerSnapshot() {
  return DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, getServerSnapshot);
}

export function setLocale(locale: Locale) {
  writeLocale(locale);
}
