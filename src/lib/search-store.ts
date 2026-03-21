"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "lastbite-search-change";
const EMPTY_QUERY = "";
let _query = EMPTY_QUERY;

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

function getSnapshot() {
  return _query;
}

function getServerSnapshot() {
  return EMPTY_QUERY;
}

export function useSearchQuery(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setSearchQuery(q: string) {
  _query = q;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}
