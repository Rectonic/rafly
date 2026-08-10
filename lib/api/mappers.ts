/**
 * Row mappers and error mapping for the Supabase backed facades.
 *
 * Everything the database hands back is snake case, and some of it carries
 * internal columns that must never reach a screen. These mappers are the only
 * place that translation happens, so a new column added to a table cannot leak
 * through by accident, a mapper has to be edited for it to appear in a DTO.
 *
 * Two row shapes exist for one offer DTO:
 *
 * - the public view row, already redacted and already carrying the store name,
 *   address, coordinates and computed discount
 * - the raw offers_v2 row returned by the seller mutation RPCs, which carries
 *   store_product_id, publish_idempotency_key, physically_set_aside,
 *   approved_by, quantity_total and created_at, and carries no store details
 *   or discount at all
 *
 * mapSellerOfferRow redacts the first set and enriches the second, so both
 * paths produce the identical MarketplaceOfferV2 key set.
 */

import type {
  CommandErrorCode,
  InventorySummaryV2,
  MarketplaceOfferStatusV2,
  MarketplaceOfferV2,
  BuyerReservationV2,
  ReservationStatusV2,
  Result,
  SellerPickupV2,
  StockAdjustmentProposalV2,
  StockConfidenceV2,
  StoreExceptionV2,
  StoreMembershipV2,
  StoreRole,
} from "@/lib/contracts";
import { err } from "@/lib/contracts";
import { sha256Hex } from "@/lib/api/pickup-code";

/** Every store in the beta trades in Tashkent, and no table stores this. */
export const PUBLIC_OFFER_TIMEZONE = "Asia/Tashkent" as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A uuid for a client supplied id that the contract types as a plain string.
 *
 * count_sessions.id is a uuid column and its value comes from the caller, so
 * an id such as count-session-1 is a perfectly legal contract value that
 * Postgres cannot store. Hashing it gives a stable uuid, which is the only
 * property that matters here, since the primary key on that column is what
 * makes record_inventory_count_v2 idempotent. The same string always derives
 * the same uuid, so a retry still replays instead of counting twice.
 *
 * A value that is already a uuid passes through, so the id a client generated
 * is the id sitting in the table when somebody goes looking for it.
 */
export function toStableUuid(value: string): string {
  if (UUID_PATTERN.test(value)) {
    return value.toLowerCase();
  }

  const hex = sha256Hex(value);
  const variant = "89ab"[parseInt(hex[16], 16) % 4];
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `8${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * PostgREST renders timestamptz as an offset form such as
 * 2026-08-10T17:00:00+00:00 while the in memory fake and every contract
 * example use the Z form with milliseconds. Normalising here means an
 * assertion can compare a value that came from the database against one that
 * came from the fake without either side knowing which produced it.
 */
export function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function toIsoDateTimeOrNull(value: string | null): string | null {
  return value === null ? null : toIsoDateTime(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return typeof value === "number" ? value : Number(value);
}

/**
 * The public discount rule, kept identical to the expression in
 * marketplace_offers_v2_public and to computeDiscountPercent in the fake. A
 * discount only exists when a positive reference price was published.
 */
export function computeDiscountPercent(
  offerPriceUzs: number,
  referencePriceUzs: number | null
): number | null {
  if (typeof referencePriceUzs !== "number" || referencePriceUzs <= 0) {
    return null;
  }
  return Math.round((1 - offerPriceUzs / referencePriceUzs) * 100);
}

export interface PublicOfferRow {
  id: string;
  version: number;
  store_id: string;
  store_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  title: string;
  category: string;
  image_url: string | null;
  contents: unknown;
  offer_price_uzs: number;
  reference_price_uzs: number | null;
  discount_percent: number | null;
  quantity_available: number;
  pickup_start: string;
  pickup_end: string;
  allergens: unknown;
  dietary_badges: unknown;
  pickup_instructions: string | null;
  cancellation_policy: string | null;
  last_verified_at: string;
  status: MarketplaceOfferStatusV2;
}

export interface RawOfferRow {
  id: string;
  store_id: string;
  store_product_id: string;
  title: string;
  category: string;
  image_url: string | null;
  contents: unknown;
  offer_price_uzs: number;
  reference_price_uzs: number | null;
  quantity_total: number;
  quantity_available: number;
  pickup_start: string;
  pickup_end: string;
  allergens: unknown;
  dietary_badges: unknown;
  pickup_instructions: string | null;
  cancellation_policy: string | null;
  status: MarketplaceOfferStatusV2;
  physically_set_aside: boolean;
  last_verified_at: string | null;
  version: number;
  publish_idempotency_key: string;
  approved_by: string | null;
  created_at: string;
}

/** Store fields the raw offer row does not carry, read from public.stores. */
export interface StoreEnrichment {
  storeName: string;
  storeAddress: string;
  latitude: number;
  longitude: number;
}

export interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function toStoreEnrichment(row: StoreRow): StoreEnrichment {
  return {
    storeName: row.name,
    storeAddress: row.address ?? "",
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  };
}

export function mapPublicOfferRow(row: PublicOfferRow): MarketplaceOfferV2 {
  return {
    id: row.id,
    version: row.version,
    storeId: row.store_id,
    storeName: row.store_name,
    storeAddress: row.address ?? "",
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    contents: toStringArray(row.contents),
    offerPriceUzs: row.offer_price_uzs,
    referencePriceUzs: row.reference_price_uzs,
    discountPercent:
      row.discount_percent ??
      computeDiscountPercent(row.offer_price_uzs, row.reference_price_uzs),
    quantityAvailable: row.quantity_available,
    pickupStart: toIsoDateTime(row.pickup_start),
    pickupEnd: toIsoDateTime(row.pickup_end),
    timezone: PUBLIC_OFFER_TIMEZONE,
    allergens: toStringArray(row.allergens),
    dietaryBadges: toStringArray(row.dietary_badges),
    pickupInstructions: row.pickup_instructions,
    cancellationPolicy: row.cancellation_policy,
    lastVerifiedAt: toIsoDateTime(row.last_verified_at),
    status: row.status,
  };
}

/**
 * Redacts a raw offers_v2 row and enriches it into the public offer DTO.
 *
 * Dropped on purpose: store_product_id, publish_idempotency_key,
 * physically_set_aside, approved_by, quantity_total and created_at. Those are
 * the store's own book keeping, and the seller screens read them from the
 * inventory summary rather than from an offer.
 *
 * last_verified_at is nullable on the table even though publish always fills
 * it, so the pickup start stands in for a row that somehow has none. The
 * contract field is not nullable and a screen showing an empty verification
 * time would be worse than one showing the window it was published for.
 */
export function mapSellerOfferRow(
  row: RawOfferRow,
  store: StoreEnrichment
): MarketplaceOfferV2 {
  return {
    id: row.id,
    version: row.version,
    storeId: row.store_id,
    storeName: store.storeName,
    storeAddress: store.storeAddress,
    latitude: store.latitude,
    longitude: store.longitude,
    title: row.title,
    category: row.category,
    imageUrl: row.image_url,
    contents: toStringArray(row.contents),
    offerPriceUzs: row.offer_price_uzs,
    referencePriceUzs: row.reference_price_uzs,
    discountPercent: computeDiscountPercent(
      row.offer_price_uzs,
      row.reference_price_uzs
    ),
    quantityAvailable: row.quantity_available,
    pickupStart: toIsoDateTime(row.pickup_start),
    pickupEnd: toIsoDateTime(row.pickup_end),
    timezone: PUBLIC_OFFER_TIMEZONE,
    allergens: toStringArray(row.allergens),
    dietaryBadges: toStringArray(row.dietary_badges),
    pickupInstructions: row.pickup_instructions,
    cancellationPolicy: row.cancellation_policy,
    lastVerifiedAt: toIsoDateTime(row.last_verified_at ?? row.pickup_start),
    status: row.status,
  };
}

export interface ReservationRow {
  id: string;
  version: number;
  offer_id: string;
  status: ReservationStatusV2;
  quantity: number;
  offer_snapshot: PublicOfferRow;
  pickup_code_hint: string;
  hold_expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a reservation row from reserve_offer_v2, cancel_reservation_v2 or
 * get_buyer_reservations_v2. All three already drop pickup_code_hash,
 * installation_id and client_reservation_id, and this mapper names its fields
 * one at a time so a future column cannot ride along either.
 *
 * offer_snapshot is captured AFTER the reserving decrement, so its status and
 * version describe the offer at the moment of the hold and not the reservation
 * itself. Never render snapshot.status or snapshot.version as reservation
 * state, the reservation's own status and version are the authoritative pair.
 * The snapshot exists so a buyer keeps seeing the title, price and window they
 * agreed to even after the seller edits or pauses the offer.
 */
export function mapReservationRow(row: ReservationRow): BuyerReservationV2 {
  return {
    id: row.id,
    version: row.version,
    offerId: row.offer_id,
    status: row.status,
    quantity: 1,
    offerSnapshot: mapPublicOfferRow(row.offer_snapshot),
    pickupCodeHint: row.pickup_code_hint,
    holdExpiresAt: toIsoDateTime(row.hold_expires_at),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  };
}

export interface SellerPickupRow {
  reservation_id: string;
  offer_id: string;
  offer_title: string;
  status: ReservationStatusV2;
  pickup_code_hint: string;
  hold_expires_at: string;
  pickup_start: string;
  pickup_end: string;
  created_at: string;
  version: number;
}

export function mapSellerPickupRow(row: SellerPickupRow): SellerPickupV2 {
  return {
    reservationId: row.reservation_id,
    offerId: row.offer_id,
    offerTitle: row.offer_title,
    status: row.status,
    pickupCodeHint: row.pickup_code_hint,
    holdExpiresAt: toIsoDateTime(row.hold_expires_at),
    pickupStart: toIsoDateTime(row.pickup_start),
    pickupEnd: toIsoDateTime(row.pickup_end),
    createdAt: toIsoDateTime(row.created_at),
    version: row.version,
  };
}

export interface InventoryRow {
  store_product_id: string;
  store_id: string;
  product_name: string;
  barcode: string | null;
  category: string | null;
  on_hand_quantity: number;
  confidence: StockConfidenceV2;
  last_verified_at: string | null;
  max_offerable_quantity: number;
  allocated_quantity: number;
  expiry_date: string | null;
  has_open_exceptions: boolean;
  version: number;
}

export function mapInventoryRow(row: InventoryRow): InventorySummaryV2 {
  return {
    storeProductId: row.store_product_id,
    storeId: row.store_id,
    productName: row.product_name,
    barcode: row.barcode,
    category: row.category,
    onHandQuantity: row.on_hand_quantity,
    confidence: row.confidence,
    lastVerifiedAt: toIsoDateTimeOrNull(row.last_verified_at),
    maxOfferableQuantity: row.max_offerable_quantity,
    allocatedQuantity: row.allocated_quantity,
    expiryDate: row.expiry_date,
    hasOpenExceptions: row.has_open_exceptions,
    version: row.version,
  };
}

export interface ProposalRow {
  id: string;
  store_id: string;
  store_product_id: string;
  current_quantity: number;
  proposed_quantity: number;
  delta: number;
  reason: string;
  status: StockAdjustmentProposalV2["status"];
  created_by_role: StoreRole;
  created_at: string;
  version: number;
}

/**
 * The proposals table has no product name column, so the caller reads it from
 * store_products and passes it in. An unresolved id keeps an empty name rather
 * than failing the whole read, since a proposal for a product that vanished is
 * still a proposal the store has to decide on.
 */
export function mapProposalRow(
  row: ProposalRow,
  productName: string
): StockAdjustmentProposalV2 {
  return {
    id: row.id,
    storeId: row.store_id,
    storeProductId: row.store_product_id,
    productName,
    currentQuantity: row.current_quantity,
    proposedQuantity: row.proposed_quantity,
    delta: row.delta,
    reason: "count",
    status: row.status,
    createdByRole: row.created_by_role,
    createdAt: toIsoDateTime(row.created_at),
    version: row.version,
  };
}

export interface ExceptionRow {
  id: string;
  store_id: string;
  kind: StoreExceptionV2["kind"];
  message: string;
  status: StoreExceptionV2["status"];
  related_offer_id: string | null;
  related_store_product_id: string | null;
  created_at: string;
}

export function mapExceptionRow(row: ExceptionRow): StoreExceptionV2 {
  return {
    id: row.id,
    storeId: row.store_id,
    kind: row.kind,
    message: row.message,
    status: row.status,
    relatedOfferId: row.related_offer_id,
    relatedStoreProductId: row.related_store_product_id,
    createdAt: toIsoDateTime(row.created_at),
  };
}

export interface MembershipRow {
  store_id: string;
  store_name: string;
  role: StoreRole;
  pilot_mode_enabled: boolean;
  shop_seller_beta_enabled: boolean;
}

export function mapMembershipRow(row: MembershipRow): StoreMembershipV2 {
  return {
    storeId: row.store_id,
    storeName: row.store_name,
    role: row.role,
    storeFlags: {
      pilotModeEnabled: row.pilot_mode_enabled,
      shopSellerBetaEnabled: row.shop_seller_beta_enabled,
    },
  };
}

const ERROR_PREFIXES: ReadonlySet<string> = new Set<CommandErrorCode>([
  "not_found",
  "forbidden",
  "validation_failed",
  "version_conflict",
  "invalid_state",
  "idempotency_conflict",
  "sold_out",
  "offer_not_live",
  "allocation_exceeded",
]);

const NETWORK_PATTERN =
  /network request failed|fetch failed|failed to fetch|networkerror|econnrefused|socket hang up/i;

// Postgres reports a malformed uuid literal as 22P02 with a message that has
// no contract prefix. From a caller's point of view an id the database cannot
// even parse names nothing that exists, so it reads as not_found rather than
// as an unexplained failure.
const INVALID_TEXT_REPRESENTATION = "22P02";

function readMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function readCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

/**
 * Maps anything the client layer can produce onto a CommandErrorCode.
 *
 * The contract prefix is whatever sits before the first colon of the message,
 * which is the shape every RPC in this schema raises. A prefix appearing later
 * in the sentence is body text and is ignored on purpose.
 */
export function errorCodeFrom(error: unknown): CommandErrorCode {
  const message = readMessage(error);
  const code = readCode(error);

  if (NETWORK_PATTERN.test(message)) {
    return "network_error";
  }
  if (
    code === INVALID_TEXT_REPRESENTATION ||
    /invalid input syntax for type uuid/i.test(message)
  ) {
    return "not_found";
  }

  const colonAt = message.indexOf(":");
  if (colonAt > 0) {
    const prefix = message.slice(0, colonAt).trim();
    if (ERROR_PREFIXES.has(prefix)) {
      return prefix as CommandErrorCode;
    }
  }

  return "unknown";
}

/** Turns any failure into the contract Result shape. Facades never throw. */
export function commandErrorFrom(error: unknown): Result<never> {
  const code = errorCodeFrom(error);
  const message = readMessage(error) || `the request failed with ${code}`;
  const details = readCode(error) ? { pgCode: readCode(error) } : undefined;
  return err(code, message, details);
}
