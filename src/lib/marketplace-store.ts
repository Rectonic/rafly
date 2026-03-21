"use client";

import { useSyncExternalStore } from "react";

import { buildFallbackSellerProfile } from "@/lib/backend/default-seller-profile";
import { isSupabaseConfigured } from "@/lib/auth";
import type {
  CreateInventoryItemInput,
  CreateSellerOfferInput,
  UpdateSellerProfileInput,
} from "@/lib/backend/contracts";
import type { Offer } from "@/types/offer";
import type {
  SellerPickupOrder,
  SellerWorkspaceState,
} from "@/types/seller";

const STORAGE_KEY = "lastbite-seller-workspace";
const CHANGE_EVENT = "lastbite-seller-workspace-change";
const PUBLISHED_OFFERS_EVENT = "lastbite-published-offers-change";

const DEFAULT_PICKUP_ORDERS: SellerPickupOrder[] = [
  {
    id: "pickup-1",
    customerName: "Madina R.",
    offerTitle: "Surprise Bakery Bag",
    reservationCode: "LB-48291",
    pickupWindow: "18:00-20:00",
    total: 4.9,
    status: "pending",
  },
  {
    id: "pickup-2",
    customerName: "Aziz K.",
    offerTitle: "Family Pasta Tray",
    reservationCode: "LB-93740",
    pickupWindow: "19:00-21:00",
    total: 10.9,
    status: "pending",
  },
];

const DEFAULT_STATE: SellerWorkspaceState = {
  profile: null,
  inventory: [],
  publishedOffers: [],
  pickupOrders: [],
};
const EMPTY_OFFERS: Offer[] = [];

const LOCAL_DEFAULT_STATE: SellerWorkspaceState = {
  profile: buildFallbackSellerProfile(),
  inventory: [],
  publishedOffers: [],
  pickupOrders: DEFAULT_PICKUP_ORDERS,
};

let currentState: SellerWorkspaceState = DEFAULT_STATE;
let currentPublishedOffers: Offer[] = [];
let hasLoadedWorkspace = false;
let hasLoadedPublishedOffers = false;
let workspaceLoadPromise: Promise<void> | null = null;
let publicOffersLoadPromise: Promise<void> | null = null;

const workspaceListeners = new Set<() => void>();
const publishedOffersListeners = new Set<() => void>();

function canUseDOM() {
  return typeof window !== "undefined";
}

function isRemoteMode() {
  return canUseDOM() && isSupabaseConfigured();
}

function emitWorkspaceChange() {
  workspaceListeners.forEach((listener) => listener());
}

function emitPublishedOffersChange() {
  publishedOffersListeners.forEach((listener) => listener());
  if (canUseDOM()) {
    window.dispatchEvent(new Event(PUBLISHED_OFFERS_EVENT));
  }
}

function setWorkspaceState(nextState: SellerWorkspaceState) {
  currentState = nextState;
  emitWorkspaceChange();
}

function setPublishedOffers(nextOffers: Offer[]) {
  currentPublishedOffers = nextOffers;
  emitPublishedOffersChange();
}

function readLocalState(): SellerWorkspaceState {
  if (!canUseDOM()) {
    return LOCAL_DEFAULT_STATE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return LOCAL_DEFAULT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SellerWorkspaceState>;

    return {
      profile: parsed.profile ?? LOCAL_DEFAULT_STATE.profile,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      publishedOffers: Array.isArray(parsed.publishedOffers)
        ? parsed.publishedOffers
        : [],
      pickupOrders: Array.isArray(parsed.pickupOrders)
        ? parsed.pickupOrders
        : LOCAL_DEFAULT_STATE.pickupOrders,
    };
  } catch {
    return LOCAL_DEFAULT_STATE;
  }
}

function writeLocalState(nextState: SellerWorkspaceState) {
  if (!canUseDOM()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  setWorkspaceState(nextState);
  setPublishedOffers(nextState.publishedOffers);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(errorPayload?.message ?? "Request failed.");
  }

  return (await response.json()) as T;
}

async function refreshPublishedOffers() {
  if (!canUseDOM()) {
    return;
  }

  if (!isRemoteMode()) {
    const localState = readLocalState();
    setPublishedOffers(localState.publishedOffers);
    return;
  }

  const response = await fetch("/api/offers", {
    cache: "no-store",
    credentials: "include",
  });
  const offers = await parseJsonResponse<Offer[]>(response);
  setPublishedOffers(offers);
}

async function loadWorkspace() {
  if (!canUseDOM()) {
    return;
  }

  if (!isRemoteMode()) {
    const localState = readLocalState();
    hasLoadedWorkspace = true;
    setWorkspaceState(localState);
    setPublishedOffers(localState.publishedOffers);
    return;
  }

  const response = await fetch("/api/seller/workspace", {
    cache: "no-store",
    credentials: "include",
  });

  if (response.status === 401) {
    hasLoadedWorkspace = true;
    setWorkspaceState(DEFAULT_STATE);
    return;
  }

  const workspace = await parseJsonResponse<SellerWorkspaceState>(response);
  hasLoadedWorkspace = true;
  setWorkspaceState(workspace);
}

function ensureWorkspaceLoaded() {
  if (!canUseDOM() || hasLoadedWorkspace) {
    return;
  }

  if (!workspaceLoadPromise) {
    workspaceLoadPromise = loadWorkspace().finally(() => {
      workspaceLoadPromise = null;
    });
  }
}

function ensurePublishedOffersLoaded() {
  if (!canUseDOM() || hasLoadedPublishedOffers) {
    return;
  }

  if (!publicOffersLoadPromise) {
    publicOffersLoadPromise = refreshPublishedOffers()
      .catch(() => undefined)
      .finally(() => {
        hasLoadedPublishedOffers = true;
        publicOffersLoadPromise = null;
      });
  }
}

function subscribeWorkspace(listener: () => void) {
  if (!canUseDOM()) {
    return () => undefined;
  }

  ensureWorkspaceLoaded();
  workspaceListeners.add(listener);

  const handleChange = () => {
    if (!isRemoteMode()) {
      setWorkspaceState(readLocalState());
    }
    listener();
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    workspaceListeners.delete(listener);
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function subscribePublishedOffers(listener: () => void) {
  if (!canUseDOM()) {
    return () => undefined;
  }

  ensurePublishedOffersLoaded();
  publishedOffersListeners.add(listener);

  const handleChange = () => {
    if (!isRemoteMode()) {
      setPublishedOffers(readLocalState().publishedOffers);
    }
    listener();
  };

  window.addEventListener(PUBLISHED_OFFERS_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    publishedOffersListeners.delete(listener);
    window.removeEventListener(PUBLISHED_OFFERS_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getWorkspaceSnapshot() {
  return currentState;
}

function getPublishedOffersSnapshot() {
  return currentPublishedOffers;
}

function getWorkspaceServerSnapshot() {
  return DEFAULT_STATE;
}

function getPublishedOffersServerSnapshot() {
  return EMPTY_OFFERS;
}

export function useSellerWorkspace() {
  return useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getWorkspaceServerSnapshot
  );
}

export function usePublishedSellerOffers() {
  return useSyncExternalStore(
    subscribePublishedOffers,
    getPublishedOffersSnapshot,
    getPublishedOffersServerSnapshot
  );
}

export async function saveSellerProfile(input: UpdateSellerProfileInput) {
  if (!isRemoteMode()) {
    const localState = {
      ...readLocalState(),
      profile: {
        ...(readLocalState().profile ?? buildFallbackSellerProfile()),
        businessName: input.businessName,
        businessType: input.businessType,
        category: input.category,
        address: input.address,
        location: {
          lat: input.latitude,
          lng: input.longitude,
          address: input.address,
        },
        updatedAt: new Date().toISOString(),
      },
    };

    writeLocalState(localState);
    return localState;
  }

  const response = await fetch("/api/seller/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const workspace = await parseJsonResponse<SellerWorkspaceState>(response);
  setWorkspaceState(workspace);
  await refreshPublishedOffers();
  return workspace;
}

export async function addInventoryItem(input: CreateInventoryItemInput & { id?: string; createdAt?: string }) {
  if (!isRemoteMode()) {
    const current = readLocalState();
    const nextState = {
      ...current,
      inventory: [
        {
          id: input.id ?? `inventory-${Date.now()}`,
          productName: input.productName,
          barcode: input.barcode,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          source: input.source,
          ocrText: input.ocrText,
          createdAt: input.createdAt ?? new Date().toISOString(),
        },
        ...current.inventory,
      ].slice(0, 20),
    };

    writeLocalState(nextState);
    return nextState;
  }

  const response = await fetch("/api/seller/inventory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      productName: input.productName,
      barcode: input.barcode,
      expiryDate: input.expiryDate,
      quantity: input.quantity,
      source: input.source,
      ocrText: input.ocrText,
    } satisfies CreateInventoryItemInput),
  });

  const workspace = await parseJsonResponse<SellerWorkspaceState>(response);
  setWorkspaceState(workspace);
  return workspace;
}

export async function publishSellerOffer(input: Offer) {
  if (!isRemoteMode()) {
    const current = readLocalState();
    const nextState = {
      ...current,
      publishedOffers: [input, ...current.publishedOffers].slice(0, 24),
    };

    writeLocalState(nextState);
    return nextState;
  }

  const response = await fetch("/api/seller/offers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      title: input.title,
      category: input.category,
      image: input.image,
      oldPrice: input.oldPrice,
      newPrice: input.newPrice,
      pickupStart: input.pickupStart,
      endTime: input.endTime,
      quantityAvailable: input.quantityAvailable,
      contents: input.contents,
    } satisfies CreateSellerOfferInput),
  });

  const workspace = await parseJsonResponse<SellerWorkspaceState>(response);
  setWorkspaceState(workspace);
  await refreshPublishedOffers();
  return workspace;
}

export async function verifyPickupOrder(reservationCode: string) {
  if (!isRemoteMode()) {
    const current = readLocalState();
    let matchedOrder: SellerPickupOrder | null = null;

    const nextOrders = current.pickupOrders.map((order) => {
      if (
        order.reservationCode !== reservationCode ||
        order.status !== "pending"
      ) {
        return order;
      }

      matchedOrder = {
        ...order,
        status: "collected",
      };

      return matchedOrder;
    });

    if (!matchedOrder) {
      return null;
    }

    writeLocalState({
      ...current,
      pickupOrders: nextOrders,
    });

    return matchedOrder;
  }

  const response = await fetch("/api/seller/pickup/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ reservationCode }),
  });

  const result = await parseJsonResponse<{
    workspace: SellerWorkspaceState;
    matchedOrder: SellerPickupOrder | null;
  }>(response);
  setWorkspaceState(result.workspace);
  return result.matchedOrder;
}
