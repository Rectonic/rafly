import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  DEFAULT_SELLER_PROFILE_VALUES,
  buildFallbackSellerProfile,
} from "@/lib/backend/default-seller-profile";
import type {
  CreateInventoryItemInput,
  CreateSellerOfferInput,
  UpdateSellerProfileInput,
} from "@/lib/backend/contracts";
import { createClient } from "@/lib/supabase/server";
import type { Offer } from "@/types/offer";
import type {
  SellerInventoryItem,
  SellerPickupOrder,
  SellerProfile,
  SellerWorkspaceState,
} from "@/types/seller";

const WORKSPACE_SELECT = [
  "id",
  "product_name",
  "barcode",
  "expiry_date",
  "quantity",
  "source",
  "ocr_text",
  "created_at",
].join(",");

const OFFERS_SELECT = [
  "id",
  "title",
  "business_name",
  "image",
  "old_price",
  "new_price",
  "discount",
  "distance_text",
  "pickup_end",
  "pickup_start",
  "rating",
  "reviews",
  "category",
  "latitude",
  "longitude",
  "address",
  "quantity_available",
  "contents",
  "source",
  "business_type",
  "published_at",
  "seller_id",
  "status",
].join(",");

const PICKUP_SELECT = [
  "id",
  "customer_name",
  "offer_id",
  "reservation_code",
  "pickup_window",
  "total",
  "status",
  "created_at",
  "seller_id",
].join(",");

type SellerProfileRow = {
  id: string;
  email: string;
  business_name: string;
  business_type: "restaurant" | "shop";
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviews: number;
  created_at: string;
  updated_at: string;
};

type InventoryRow = {
  id: string;
  product_name: string;
  barcode: string;
  expiry_date: string;
  quantity: number;
  source: "camera" | "image" | "manual";
  ocr_text: string | null;
  created_at: string;
};

type OfferRow = {
  id: string;
  title: string;
  business_name: string;
  image: string | null;
  old_price: number;
  new_price: number;
  discount: number;
  distance_text: string;
  pickup_end: string;
  pickup_start: string | null;
  rating: number;
  reviews: number;
  category: Offer["category"];
  latitude: number;
  longitude: number;
  address: string;
  quantity_available: number;
  contents: string[] | null;
  source: "seed" | "seller" | null;
  business_type: "restaurant" | "shop" | "bakery" | null;
  published_at: string;
  seller_id: string;
  status: "draft" | "published" | "sold_out";
};

type PickupRow = {
  id: string;
  customer_name: string;
  offer_id: string | null;
  reservation_code: string;
  pickup_window: string;
  total: number;
  status: "pending" | "collected" | "cancelled";
  created_at: string;
  seller_id: string;
};

function mapProfile(row: SellerProfileRow): SellerProfile {
  return {
    id: row.id,
    email: row.email,
    businessName: row.business_name,
    businessType: row.business_type,
    category: row.category,
    address: row.address,
    location: {
      lat: row.latitude,
      lng: row.longitude,
      address: row.address,
    },
    rating: Number(row.rating),
    reviews: row.reviews,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInventoryItem(row: InventoryRow): SellerInventoryItem {
  return {
    id: row.id,
    productName: row.product_name,
    barcode: row.barcode,
    expiryDate: row.expiry_date,
    quantity: row.quantity,
    source: row.source,
    ocrText: row.ocr_text ?? undefined,
    createdAt: row.created_at,
  };
}

function mapOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    title: row.title,
    restaurant: row.business_name,
    image: row.image ?? "",
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    discount: row.discount,
    distance: row.distance_text,
    endTime: row.pickup_end,
    pickupStart: row.pickup_start ?? undefined,
    rating: Number(row.rating),
    reviews: row.reviews,
    category: row.category,
    location: {
      lat: row.latitude,
      lng: row.longitude,
      address: row.address,
    },
    quantityAvailable: row.quantity_available,
    contents: row.contents ?? [],
    source: row.source ?? "seller",
    businessType: row.business_type ?? "restaurant",
  };
}

function mapPickupOrder(row: PickupRow, offersById: Map<string, Offer>): SellerPickupOrder {
  const relatedOffer = row.offer_id ? offersById.get(row.offer_id) : undefined;

  return {
    id: row.id,
    customerName: row.customer_name,
    offerTitle: relatedOffer?.title ?? "Reserved package",
    reservationCode: row.reservation_code,
    pickupWindow: row.pickup_window,
    total: Number(row.total),
    status: row.status === "cancelled" ? "pending" : row.status,
  };
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

async function ensureSellerProfileInternal(user: User) {
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<SellerProfileRow>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return mapProfile(existing);
  }

  const bootstrap = {
    id: user.id,
    email: user.email ?? buildFallbackSellerProfile().email,
    business_name: DEFAULT_SELLER_PROFILE_VALUES.businessName,
    business_type: DEFAULT_SELLER_PROFILE_VALUES.businessType,
    category: DEFAULT_SELLER_PROFILE_VALUES.category,
    address: DEFAULT_SELLER_PROFILE_VALUES.address,
    latitude: DEFAULT_SELLER_PROFILE_VALUES.latitude,
    longitude: DEFAULT_SELLER_PROFILE_VALUES.longitude,
    rating: DEFAULT_SELLER_PROFILE_VALUES.rating,
    reviews: DEFAULT_SELLER_PROFILE_VALUES.reviews,
  };

  const { data: created, error: createError } = await supabase
    .from("seller_profiles")
    .insert(bootstrap)
    .select("*")
    .single<SellerProfileRow>();

  if (createError) {
    throw new Error(createError.message);
  }

  return mapProfile(created);
}

export async function getSellerWorkspaceForCurrentUser(): Promise<SellerWorkspaceState> {
  const { supabase, user } = await getAuthenticatedUser();
  const profile = await ensureSellerProfileInternal(user);

  const [inventoryResult, offersResult, pickupResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(WORKSPACE_SELECT)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<InventoryRow[]>(),
    supabase
      .from("seller_offers")
      .select(OFFERS_SELECT)
      .eq("seller_id", user.id)
      .order("published_at", { ascending: false })
      .limit(24)
      .returns<OfferRow[]>(),
    supabase
      .from("pickup_orders")
      .select(PICKUP_SELECT)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<PickupRow[]>(),
  ]);

  if (inventoryResult.error) {
    throw new Error(inventoryResult.error.message);
  }

  if (offersResult.error) {
    throw new Error(offersResult.error.message);
  }

  if (pickupResult.error) {
    throw new Error(pickupResult.error.message);
  }

  const publishedOffers = (offersResult.data ?? []).map(mapOffer);
  const offersById = new Map(publishedOffers.map((offer) => [offer.id, offer]));

  return {
    profile,
    inventory: (inventoryResult.data ?? []).map(mapInventoryItem),
    publishedOffers,
    pickupOrders: (pickupResult.data ?? []).map((row) =>
      mapPickupOrder(row, offersById)
    ),
  };
}

export async function updateSellerProfileForCurrentUser(
  input: UpdateSellerProfileInput
): Promise<SellerWorkspaceState> {
  const { supabase, user } = await getAuthenticatedUser();
  await ensureSellerProfileInternal(user);

  const { error } = await supabase
    .from("seller_profiles")
    .update({
      business_name: input.businessName,
      business_type: input.businessType,
      category: input.category,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return getSellerWorkspaceForCurrentUser();
}

export async function addInventoryItemForCurrentUser(
  input: CreateInventoryItemInput
): Promise<SellerWorkspaceState> {
  const { supabase, user } = await getAuthenticatedUser();
  await ensureSellerProfileInternal(user);

  const { error } = await supabase.from("inventory_items").insert({
    seller_id: user.id,
    product_name: input.productName,
    barcode: input.barcode,
    expiry_date: input.expiryDate,
    quantity: input.quantity,
    source: input.source,
    ocr_text: input.ocrText ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return getSellerWorkspaceForCurrentUser();
}

export async function publishSellerOfferForCurrentUser(
  input: CreateSellerOfferInput
): Promise<SellerWorkspaceState> {
  const { supabase, user } = await getAuthenticatedUser();
  const profile = await ensureSellerProfileInternal(user);
  const discount = Math.max(
    0,
    Math.round(((input.oldPrice - input.newPrice) / Math.max(input.oldPrice, 1)) * 100)
  );

  const { error } = await supabase.from("seller_offers").insert({
    seller_id: user.id,
    title: input.title,
    category: input.category,
    image: input.image,
    old_price: input.oldPrice,
    new_price: input.newPrice,
    discount,
    distance_text: "0.3 km",
    pickup_start: input.pickupStart,
    pickup_end: input.endTime,
    quantity_available: input.quantityAvailable ?? 0,
    contents: input.contents ?? [],
    source: "seller",
    business_type: profile.businessType,
    latitude: profile.location.lat,
    longitude: profile.location.lng,
    address: profile.address,
    rating: profile.rating,
    reviews: profile.reviews,
    business_name: profile.businessName,
    published_at: new Date().toISOString(),
    status: "published",
  });

  if (error) {
    throw new Error(error.message);
  }

  return getSellerWorkspaceForCurrentUser();
}

export async function verifyPickupOrderForCurrentUser(
  reservationCode: string
): Promise<{ workspace: SellerWorkspaceState; matchedOrder: SellerPickupOrder | null }> {
  const { supabase, user } = await getAuthenticatedUser();
  await ensureSellerProfileInternal(user);

  const { data: existingOrder, error: orderError } = await supabase
    .from("pickup_orders")
    .select(PICKUP_SELECT)
    .eq("seller_id", user.id)
    .eq("reservation_code", reservationCode)
    .eq("status", "pending")
    .maybeSingle<PickupRow>();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!existingOrder) {
    return {
      workspace: await getSellerWorkspaceForCurrentUser(),
      matchedOrder: null,
    };
  }

  const { error } = await supabase
    .from("pickup_orders")
    .update({ status: "collected" })
    .eq("id", existingOrder.id);

  if (error) {
    throw new Error(error.message);
  }

  const workspace = await getSellerWorkspaceForCurrentUser();
  const matchedOrder = workspace.pickupOrders.find(
    (order) => order.reservationCode === reservationCode
  ) ?? null;

  return { workspace, matchedOrder };
}

export async function getPublishedOffers(): Promise<Offer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seller_offers")
    .select(OFFERS_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .returns<OfferRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOffer);
}
