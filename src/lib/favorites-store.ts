"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "lastbite-favorites";
const CHANGE_EVENT = "lastbite-favorites-change";
const EMPTY_FAVORITES: string[] = [];

function canUseDOM() {
  return typeof window !== "undefined";
}

function readFavorites(): string[] {
  if (!canUseDOM()) return EMPTY_FAVORITES;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_FAVORITES;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return EMPTY_FAVORITES;
  }
}

function writeFavorites(ids: string[]) {
  if (!canUseDOM()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
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
  return EMPTY_FAVORITES;
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, readFavorites, getServerSnapshot);
}

export function toggleFavorite(offerId: string) {
  const current = readFavorites();
  const next = current.includes(offerId)
    ? current.filter((id) => id !== offerId)
    : [...current, offerId];
  writeFavorites(next);
}
