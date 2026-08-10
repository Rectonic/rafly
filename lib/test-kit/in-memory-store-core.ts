/**
 * In memory Store Core fake.
 *
 * One deterministic world holding stores, memberships, products, offers,
 * reservations, adjustment proposals, exceptions, stock movements, an audit
 * trail and a transactional outbox. It implements both coordinator owned
 * facades so product surfaces and the cross product suite can run without a
 * backend, and it is the reference behaviour the Supabase backed facades must
 * reproduce.
 *
 * Determinism rules:
 * - the clock is injected through setNow and defaults to DEFAULT_NOW
 * - every id comes from a seeded counter, nothing random
 * - pickup codes come from a seeded counter as LB plus a four digit sequence
 * - no timers and no real async work, every method resolves immediately
 *
 * Error rules:
 * - facade methods never throw, they always resolve to a Result
 * - unexpected internal throws are converted to the unknown error code
 */

import type { BuyerMarketplaceApiV2, SellerStoreApiV2 } from "@/lib/api";
import {
  err,
  ok,
  type ApproveStockAdjustmentV2Input,
  type BuyerReservationV2,
  type CancelReservationV2Input,
  type DecideStagedRecordV2Input,
  type ExpiryWatchItemV2,
  type FulfillReservationV2Input,
  type ImportBatchV2,
  type InventorySummaryV2,
  type MarketplaceOfferStatusV2,
  type MarketplaceOfferV2,
  type PauseOfferV2Input,
  type PublishOfferV2Input,
  type RecordInventoryCountV2Input,
  type ReportStockMismatchV2Input,
  type ResolveStoreExceptionV2Input,
  type ReservationStatusV2,
  type ReserveOfferV2Input,
  type ReserveOfferV2Result,
  type Result,
  type SellerPickupV2,
  type StagedSourceRecordV2,
  type StockAdjustmentProposalV2,
  type StockConfidenceV2,
  type StoreExceptionV2,
  type StoreMembershipV2,
  type StoreRole,
  type UploadImportBatchV2Input,
} from "@/lib/contracts";

import { installationAuditActor } from "./audit-actor";

export const DEFAULT_NOW = "2026-08-10T09:00:00.000Z";

const MANAGER_ROLES: readonly StoreRole[] = ["manager", "owner"];
const COUNT_ROLES: readonly StoreRole[] = ["staff", "manager", "owner"];
const TERMINAL_OFFER_STATUSES: readonly MarketplaceOfferStatusV2[] = [
  "expired",
  "withdrawn",
];

export interface CreateStoreInput {
  name: string;
  pilotModeEnabled: boolean;
  shopSellerBetaEnabled: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddMembershipInput {
  storeId: string;
  userId: string;
  role: StoreRole;
}

export interface AddProductInput {
  storeId: string;
  productName: string;
  barcode?: string | null;
  category?: string | null;
  onHandQuantity: number;
  confidence: StockConfidenceV2;
  lastVerifiedAt?: string | null;
  expiryDate?: string | null;
}

export interface AuditEntryV2 {
  id: string;
  storeId: string;
  command: string;
  at: string;
  actorUserId: string | null;
  /**
   * A one way reference to the buyer installation behind a buyer command,
   * never the raw installation id. The id is a bearer secret, an audit row is
   * long lived, and the only question an audit reader has is whether two rows
   * came from the same caller. See lib/test-kit/audit-actor.ts, and
   * reserve_offer_v2 in SQL, which computes the identical string.
   */
  installationRef: string | null;
}

export interface OutboxEventV2 {
  id: string;
  name: string;
  storeId: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface StockMovementV2 {
  id: string;
  storeId: string;
  storeProductId: string;
  delta: number;
  reason: string;
  at: string;
}

interface StoreRecord {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  pilotModeEnabled: boolean;
  shopSellerBetaEnabled: boolean;
}

interface MembershipRecord {
  storeId: string;
  userId: string;
  role: StoreRole;
}

interface ProductRecord {
  id: string;
  storeId: string;
  productName: string;
  barcode: string | null;
  category: string | null;
  onHandQuantity: number;
  confidence: StockConfidenceV2;
  lastVerifiedAt: string | null;
  expiryDate: string | null;
  version: number;
}

interface OfferAllocationRecord {
  storeProductId: string;
  quantity: number;
  physicallySetAside: boolean;
}

interface OfferRecord {
  id: string;
  version: number;
  storeId: string;
  title: string;
  category: string;
  imageUrl: string | null;
  contents: string[];
  offerPriceUzs: number;
  referencePriceUzs: number | null;
  discountPercent: number | null;
  quantityAvailable: number;
  pickupStart: string;
  pickupEnd: string;
  allergens: string[];
  dietaryBadges: string[];
  pickupInstructions: string | null;
  cancellationPolicy: string | null;
  lastVerifiedAt: string;
  status: MarketplaceOfferStatusV2;
  allocation: OfferAllocationRecord;
}

interface ReservationRecord {
  id: string;
  sequence: number;
  version: number;
  offerId: string;
  storeId: string;
  installationId: string;
  status: ReservationStatusV2;
  pickupCode: string;
  offerSnapshot: MarketplaceOfferV2;
  holdExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface IdempotencyRecord {
  fingerprint: string;
  result: Result<unknown>;
}

interface ImportBatchRecord extends ImportBatchV2 {
  sequence: number;
}

interface StagedSourceRecord extends StagedSourceRecordV2 {
  sequence: number;
}

interface ProductAliasRecord {
  id: string;
  storeId: string;
  storeProductId: string;
  alias: string;
  approved: boolean;
}

interface InventoryObservationRecord {
  id: string;
  storeId: string;
  storeProductId: string;
  stagedSourceRecordId: string;
  observedQuantity: number;
  confidence: "low";
  createdAt: string;
}

function padSequence(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Structural clone of a stored command result. Every payload is a plain DTO of
 * strings, numbers, booleans, nulls, arrays and nested objects, so a JSON round
 * trip is enough and keeps the fake free of extra dependencies.
 */
function cloneResult(result: Result<unknown>): Result<unknown> {
  return JSON.parse(JSON.stringify(result)) as Result<unknown>;
}

export class InMemoryStoreCore {
  private now: string = DEFAULT_NOW;

  private readonly stores = new Map<string, StoreRecord>();
  private readonly memberships = new Map<string, MembershipRecord>();
  private readonly products = new Map<string, ProductRecord>();
  private readonly offers = new Map<string, OfferRecord>();
  private readonly reservations = new Map<string, ReservationRecord>();
  private readonly proposals = new Map<string, StockAdjustmentProposalV2>();
  private readonly exceptions = new Map<string, StoreExceptionV2>();
  private readonly importBatches = new Map<string, ImportBatchRecord>();
  private readonly stagedRecords = new Map<string, StagedSourceRecord>();
  private readonly productAliases = new Map<string, ProductAliasRecord>();
  private readonly inventoryObservations = new Map<
    string,
    InventoryObservationRecord
  >();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  /** Which store first claimed each client supplied count session id. */
  private readonly countSessionStores = new Map<string, string>();

  private readonly movements: StockMovementV2[] = [];
  private readonly auditEntries: AuditEntryV2[] = [];
  private readonly outboxEvents: OutboxEventV2[] = [];

  private readonly counters = new Map<string, number>();

  // Admin helpers, used by scenario builders and by tests that need extra data.

  createStore(input: CreateStoreInput): string {
    const id = `store-${this.nextSequence("store")}`;
    this.stores.set(id, {
      id,
      name: input.name,
      address: input.address ?? "1 Amir Temur Avenue, Tashkent",
      latitude: input.latitude ?? 41.3111,
      longitude: input.longitude ?? 69.2797,
      pilotModeEnabled: input.pilotModeEnabled,
      shopSellerBetaEnabled: input.shopSellerBetaEnabled,
    });
    return id;
  }

  addMembership(input: AddMembershipInput): void {
    this.memberships.set(`${input.storeId}::${input.userId}`, {
      storeId: input.storeId,
      userId: input.userId,
      role: input.role,
    });
  }

  addProduct(input: AddProductInput): string {
    const id = `product-${this.nextSequence("product")}`;
    this.products.set(id, {
      id,
      storeId: input.storeId,
      productName: input.productName,
      barcode: input.barcode ?? null,
      category: input.category ?? null,
      onHandQuantity: input.onHandQuantity,
      confidence: input.confidence,
      lastVerifiedAt: input.lastVerifiedAt ?? null,
      expiryDate: input.expiryDate ?? null,
      version: 1,
    });
    return id;
  }

  setNow(iso: string): void {
    this.now = iso;
  }

  getNow(): string {
    return this.now;
  }

  listAuditEntries(): AuditEntryV2[] {
    return this.auditEntries.map((entry) => ({ ...entry }));
  }

  listOutboxEvents(): OutboxEventV2[] {
    return this.outboxEvents.map((event) => ({
      ...event,
      payload: { ...event.payload },
    }));
  }

  listStockMovements(): StockMovementV2[] {
    return this.movements.map((movement) => ({ ...movement }));
  }

  listImportEffects() {
    return {
      aliases: [...this.productAliases.values()].map((alias) => ({
        storeId: alias.storeId,
        storeProductId: alias.storeProductId,
        alias: alias.alias,
        approved: alias.approved,
      })),
      observations: [...this.inventoryObservations.values()].map(
        (observation) => ({
          storeId: observation.storeId,
          storeProductId: observation.storeProductId,
          stagedSourceRecordId: observation.stagedSourceRecordId,
          observedQuantity: observation.observedQuantity,
          confidence: observation.confidence,
          createdAt: observation.createdAt,
        })
      ),
      proposals: [...this.proposals.values()].map((proposal) => ({
        storeId: proposal.storeId,
        storeProductId: proposal.storeProductId,
        currentQuantity: proposal.currentQuantity,
        proposedQuantity: proposal.proposedQuantity,
        delta: proposal.delta,
        reason: proposal.reason,
        status: proposal.status,
        createdByRole: proposal.createdByRole,
      })),
    };
  }

  // Facades.

  buyerApi(): BuyerMarketplaceApiV2 {
    return {
      listMarketplaceOffersV2: async () =>
        this.guard(() => this.listMarketplaceOffers()),
      getMarketplaceOfferV2: async (offerId) =>
        this.guard(() => this.getMarketplaceOffer(offerId)),
      reserveOfferV2: async (input) => this.guard(() => this.reserveOffer(input)),
      cancelReservationV2: async (input) =>
        this.guard(() => this.cancelReservation(input)),
      getBuyerReservationsV2: async (installationId) =>
        this.guard(() => this.getBuyerReservations(installationId)),
    };
  }

  sellerApi(actor: { userId: string }): SellerStoreApiV2 {
    const userId = actor.userId;
    return {
      getMyStoreMembershipsV2: async () =>
        this.guard(() => this.getMyStoreMemberships(userId)),
      listStoreOffersV2: async (storeId) =>
        this.guard(() => this.listStoreOffers(userId, storeId)),
      listStoreInventoryV2: async (storeId) =>
        this.guard(() => this.listStoreInventory(userId, storeId)),
      listExpiryWatchlistV2: async (storeId) =>
        this.guard(() => this.listExpiryWatchlist(userId, storeId)),
      recordInventoryCountV2: async (input) =>
        this.guard(() => this.recordInventoryCount(userId, input)),
      approveStockAdjustmentV2: async (input) =>
        this.guard(() => this.approveStockAdjustment(userId, input)),
      approveAndPublishOfferV2: async (input) =>
        this.guard(() => this.approveAndPublishOffer(userId, input)),
      pauseOfferV2: async (input) => this.guard(() => this.pauseOffer(userId, input)),
      listSellerPickupsV2: async (storeId) =>
        this.guard(() => this.listSellerPickups(userId, storeId)),
      fulfillReservationV2: async (input) =>
        this.guard(() => this.fulfillReservation(userId, input)),
      reportStockMismatchV2: async (input) =>
        this.guard(() => this.reportStockMismatch(userId, input)),
      resolveStoreExceptionV2: async (input) =>
        this.guard(() => this.resolveStoreException(userId, input)),
      listStoreExceptionsV2: async (storeId) =>
        this.guard(() => this.listStoreExceptions(userId, storeId)),
      uploadImportBatchV2: async (input) =>
        this.guard(() => this.uploadImportBatch(userId, input)),
      listImportBatchesV2: async (storeId) =>
        this.guard(() => this.listImportBatches(userId, storeId)),
      listStagedRecordsV2: async (storeId, batchId) =>
        this.guard(() => this.listStagedRecords(userId, storeId, batchId)),
      decideStagedRecordV2: async (input) =>
        this.guard(() => this.decideStagedRecord(userId, input)),
    };
  }

  // Buyer commands and queries.

  private listMarketplaceOffers(): Result<MarketplaceOfferV2[]> {
    this.applyLazyExpiry();
    const nowMs = Date.parse(this.now);
    // sold_out offers stay visible, matching marketplace_offers_v2_public,
    // whose where clause is status in ('live', 'sold_out') and pickup_end in
    // the future. A buyer who saw a card and lost the race to it is owed a
    // sold out card rather than a listing that silently drops the offer out
    // from under them, and the buyer surfaces already render that status as a
    // disabled card.
    const visible = [...this.offers.values()]
      .filter(
        (offer) =>
          (offer.status === "live" || offer.status === "sold_out") &&
          Date.parse(offer.pickupEnd) > nowMs
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    return ok(visible.map((offer) => this.projectOffer(offer)));
  }

  private getMarketplaceOffer(offerId: string): Result<MarketplaceOfferV2> {
    this.applyLazyExpiry();
    const offer = this.offers.get(offerId);
    if (!offer) {
      return err("not_found", `offer ${offerId} does not exist`);
    }
    return ok(this.projectOffer(offer));
  }

  private reserveOffer(
    input: ReserveOfferV2Input
  ): Result<ReserveOfferV2Result> {
    this.applyLazyExpiry();

    const fingerprint = JSON.stringify({
      offerId: input.offerId,
      installationId: input.installationId,
      quantity: input.quantity,
    });
    const replay = this.readIdempotent<ReserveOfferV2Result>(
      "reserveOfferV2",
      input.installationId,
      input.clientReservationId,
      fingerprint
    );
    if (replay) {
      if (!replay.ok) {
        return replay;
      }
      // A replay never re-issues the raw pickup code, and it never hands back
      // the snapshot of how the reservation looked when it was created. The
      // caller gets the live row as it stands right now, so an id whose
      // reservation was since cancelled, fulfilled or expired replays as
      // terminal rather than looking like a fresh hold.
      const live = this.reservations.get(replay.value.reservation.id);
      return ok<ReserveOfferV2Result>({
        reservation: live
          ? this.projectReservation(live)
          : replay.value.reservation,
        pickupCode: null,
      });
    }

    if (input.quantity !== 1) {
      return err("validation_failed", "reservation quantity is fixed to one");
    }

    const offer = this.offers.get(input.offerId);
    if (!offer) {
      return err("not_found", `offer ${input.offerId} does not exist`);
    }
    if (offer.status !== "live" && offer.status !== "sold_out") {
      return err("offer_not_live", `offer ${offer.id} is ${offer.status}`);
    }
    // Availability is checked before the version because two buyers racing for
    // the last unit both hold the version they read before either won. The
    // loser of that race has to hear sold_out, the true and actionable answer,
    // rather than version_conflict, which would send them to refresh an offer
    // that has nothing left for them.
    if (offer.quantityAvailable <= 0) {
      return err("sold_out", `offer ${offer.id} has no units left`);
    }
    if (offer.version !== input.expectedOfferVersion) {
      return err("version_conflict", `offer ${offer.id} moved on`, {
        currentVersion: offer.version,
      });
    }

    offer.quantityAvailable -= 1;
    offer.version += 1;
    if (offer.quantityAvailable === 0) {
      offer.status = "sold_out";
    }

    const sequence = this.nextSequence("reservation");
    const pickupCode = `LB${padSequence(this.nextSequence("pickupCode"), 4)}`;
    const record: ReservationRecord = {
      id: `reservation-${sequence}`,
      sequence,
      version: 1,
      offerId: offer.id,
      storeId: offer.storeId,
      installationId: input.installationId,
      status: "held",
      pickupCode,
      offerSnapshot: this.projectOffer(offer),
      holdExpiresAt: offer.pickupEnd,
      createdAt: this.now,
      updatedAt: this.now,
    };
    this.reservations.set(record.id, record);

    this.appendAudit({
      storeId: offer.storeId,
      command: "reserveOfferV2",
      actorUserId: null,
      installationRef: installationAuditActor(input.installationId),
    });
    this.appendOutbox("reservation_held", offer.storeId, {
      reservationId: record.id,
      offerId: offer.id,
    });

    const result = ok<ReserveOfferV2Result>({
      reservation: this.projectReservation(record),
      pickupCode,
    });
    this.writeIdempotent(
      "reserveOfferV2",
      input.installationId,
      input.clientReservationId,
      fingerprint,
      result
    );
    return result;
  }

  private cancelReservation(
    input: CancelReservationV2Input
  ): Result<BuyerReservationV2> {
    this.applyLazyExpiry();

    const fingerprint = JSON.stringify({
      reservationId: input.reservationId,
      installationId: input.installationId,
    });
    const replay = this.readIdempotent<BuyerReservationV2>(
      "cancelReservationV2",
      input.installationId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const reservation = this.reservations.get(input.reservationId);
    if (!reservation) {
      return err(
        "not_found",
        `reservation ${input.reservationId} does not exist`
      );
    }
    if (reservation.installationId !== input.installationId) {
      return err("forbidden", "reservation belongs to another installation");
    }
    if (reservation.status !== "held") {
      return err(
        "invalid_state",
        `reservation ${reservation.id} is ${reservation.status}`
      );
    }

    reservation.status = "cancelled_by_buyer";
    reservation.version += 1;
    reservation.updatedAt = this.now;

    const offer = this.offers.get(reservation.offerId);
    if (offer && !TERMINAL_OFFER_STATUSES.includes(offer.status)) {
      offer.quantityAvailable += 1;
      offer.version += 1;
      if (offer.status === "sold_out") {
        offer.status = "live";
      }
    }

    this.appendAudit({
      storeId: reservation.storeId,
      command: "cancelReservationV2",
      actorUserId: null,
      installationRef: installationAuditActor(input.installationId),
    });
    this.appendOutbox("reservation_cancelled", reservation.storeId, {
      reservationId: reservation.id,
      offerId: reservation.offerId,
    });

    const result = ok(this.projectReservation(reservation));
    this.writeIdempotent(
      "cancelReservationV2",
      input.installationId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private getBuyerReservations(
    installationId: string
  ): Result<BuyerReservationV2[]> {
    this.applyLazyExpiry();
    const mine = [...this.reservations.values()]
      .filter((reservation) => reservation.installationId === installationId)
      .sort((left, right) => right.sequence - left.sequence);
    return ok(mine.map((reservation) => this.projectReservation(reservation)));
  }

  // Seller commands and queries.

  private getMyStoreMemberships(userId: string): Result<StoreMembershipV2[]> {
    const mine: StoreMembershipV2[] = [];
    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId) continue;
      const store = this.stores.get(membership.storeId);
      if (!store) continue;
      mine.push({
        storeId: store.id,
        storeName: store.name,
        role: membership.role,
        storeFlags: {
          pilotModeEnabled: store.pilotModeEnabled,
          shopSellerBetaEnabled: store.shopSellerBetaEnabled,
        },
      });
    }
    return ok(mine);
  }

  /**
   * Every offer the store has ever published, in every status, newest first.
   * Membership alone is enough, any role may read this list. This is the read
   * a seller needs before they can pause a live offer, since pauseOfferV2
   * takes an offerId the seller has to find first.
   */
  private listStoreOffers(
    userId: string,
    storeId: string
  ): Result<MarketplaceOfferV2[]> {
    this.applyLazyExpiry();
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    const mine = [...this.offers.values()]
      .filter((offer) => offer.storeId === storeId)
      .reverse();
    return ok(mine.map((offer) => this.projectOffer(offer)));
  }

  private listStoreInventory(
    userId: string,
    storeId: string
  ): Result<InventorySummaryV2[]> {
    this.applyLazyExpiry();
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    const summaries = [...this.products.values()]
      .filter((product) => product.storeId === storeId)
      .map((product) => this.projectInventory(product));
    return ok(summaries);
  }

  private listExpiryWatchlist(
    userId: string,
    storeId: string
  ): Result<ExpiryWatchItemV2[]> {
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    const todayMs = Date.parse(new Date(this.now).toISOString().slice(0, 10));
    const nowMs = Date.parse(this.now);
    const items = [...this.products.values()]
      .filter((product) => product.storeId === storeId && product.expiryDate !== null)
      .map((product) => {
        const daysToExpiry = Math.round(
          (Date.parse(product.expiryDate as string) - todayMs) / 86_400_000
        );
        const activeOffer = [...this.offers.values()]
          .reverse()
          .find(
            (offer) =>
              offer.allocation.storeProductId === product.id &&
              (offer.status === "live" || offer.status === "paused") &&
              Date.parse(offer.pickupEnd) > nowMs
          );
        return {
          storeProductId: product.id,
          productName: product.productName,
          expiryDate: product.expiryDate as string,
          daysToExpiry,
          onHandQuantity: product.onHandQuantity,
          confidence: product.confidence,
          hasOpenExceptions: this.hasOpenExceptionFor(product.id),
          activeOfferId: activeOffer?.id ?? null,
        };
      })
      .filter((item) => item.daysToExpiry <= 14)
      .sort(
        (left, right) =>
          left.daysToExpiry - right.daysToExpiry ||
          left.storeProductId.localeCompare(right.storeProductId)
      );
    return ok(items);
  }

  private recordInventoryCount(
    userId: string,
    input: RecordInventoryCountV2Input
  ): Result<StockAdjustmentProposalV2[]> {
    const access = this.requireRole(input.storeId, userId, COUNT_ROLES);
    if (!access.ok) return access;

    // A count session id is client supplied and owned by exactly one store,
    // mirroring the primary key on count_sessions. Reusing one under another
    // store is a caller bug, and answering it with an empty proposal list, as
    // the SQL replay branch used to, reads as "everything matched" and is a
    // lie. This check runs before the lines are looked at so a caller who
    // reuses the id hears about the id, not about a product they were never
    // going to be allowed to count.
    const sessionOwner = this.countSessionStores.get(input.countSessionId);
    if (sessionOwner !== undefined && sessionOwner !== input.storeId) {
      return err(
        "idempotency_conflict",
        `count session ${input.countSessionId} belongs to another store`
      );
    }

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      lines: input.lines.map((line) => ({
        storeProductId: line.storeProductId,
        observedQuantity: line.observedQuantity,
      })),
    });
    const replay = this.readIdempotent<StockAdjustmentProposalV2[]>(
      "recordInventoryCountV2",
      input.storeId,
      input.countSessionId,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const counted: ProductRecord[] = [];
    for (const line of input.lines) {
      const product = this.products.get(line.storeProductId);
      if (!product || product.storeId !== input.storeId) {
        return err(
          "not_found",
          `product ${line.storeProductId} is not in store ${input.storeId}`
        );
      }
      if (!Number.isInteger(line.observedQuantity) || line.observedQuantity < 0) {
        return err(
          "validation_failed",
          `observed quantity for ${line.storeProductId} must be a non negative integer`
        );
      }
      counted.push(product);
    }

    this.countSessionStores.set(input.countSessionId, input.storeId);

    const created: StockAdjustmentProposalV2[] = [];
    input.lines.forEach((line, index) => {
      const product = counted[index];
      if (line.observedQuantity === product.onHandQuantity) return;

      const proposal: StockAdjustmentProposalV2 = {
        id: `proposal-${this.nextSequence("proposal")}`,
        storeId: input.storeId,
        storeProductId: product.id,
        productName: product.productName,
        currentQuantity: product.onHandQuantity,
        proposedQuantity: line.observedQuantity,
        delta: line.observedQuantity - product.onHandQuantity,
        reason: "count",
        status: "pending",
        createdByRole: access.value.role,
        createdAt: this.now,
        version: 1,
      };
      this.proposals.set(proposal.id, proposal);
      created.push({ ...proposal });
    });

    // Confidence discipline, mirroring record_inventory_count_v2. Only a line
    // whose observed quantity already matched the ledger earns high
    // confidence. A discrepant line has just proven the ledger wrong, and it
    // stays wrong until a manager approves the proposal created above, so it
    // drops to low. Promoting a discrepant line would let the publish ceiling
    // trust a quantity the store itself reported as untrue. lastVerifiedAt
    // moves either way, somebody really did walk the shelf.
    input.lines.forEach((line, index) => {
      const product = counted[index];
      product.lastVerifiedAt = this.now;
      product.confidence =
        line.observedQuantity === product.onHandQuantity ? "high" : "low";
      product.version += 1;
    });

    this.appendAudit({
      storeId: input.storeId,
      command: "recordInventoryCountV2",
      actorUserId: userId,
      installationRef: null,
    });

    const result = ok(created);
    this.writeIdempotent(
      "recordInventoryCountV2",
      input.storeId,
      input.countSessionId,
      fingerprint,
      result
    );
    return result;
  }

  private approveStockAdjustment(
    userId: string,
    input: ApproveStockAdjustmentV2Input
  ): Result<StockAdjustmentProposalV2> {
    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      proposalId: input.proposalId,
      decision: input.decision,
    });
    const replay = this.readIdempotent<StockAdjustmentProposalV2>(
      "approveStockAdjustmentV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const proposal = this.proposals.get(input.proposalId);
    if (!proposal || proposal.storeId !== input.storeId) {
      return err(
        "not_found",
        `proposal ${input.proposalId} is not in store ${input.storeId}`
      );
    }
    if (proposal.version !== input.expectedVersion) {
      return err("version_conflict", `proposal ${proposal.id} moved on`, {
        currentVersion: proposal.version,
      });
    }
    if (proposal.status !== "pending") {
      return err("invalid_state", `proposal ${proposal.id} is ${proposal.status}`);
    }

    if (input.decision === "approve") {
      const product = this.products.get(proposal.storeProductId);
      if (!product) {
        return err(
          "not_found",
          `product ${proposal.storeProductId} does not exist`
        );
      }
      // Two guards, both mirroring approve_stock_adjustment_v2.
      //
      // The first is the raw floor. Two pending proposals computed before
      // either was reviewed can together drive on hand negative even though
      // neither alone would.
      const resulting = product.onHandQuantity + proposal.delta;
      if (resulting < 0) {
        return err(
          "validation_failed",
          "adjustment would make stock negative"
        );
      }
      // The second is the encumbrance floor. Units already promised through a
      // live, paused, or sold out offer that is not physically set aside are
      // backed by this ledger row and nothing else, so an approved downward
      // adjustment underneath that promise is an oversell that only surfaces
      // at the counter. Set aside offers are excluded, their units are on a
      // shelf rather than in this number.
      const promised = this.allocatedFor(product.id, { ledgerBackedOnly: true });
      if (resulting < promised) {
        return err(
          "validation_failed",
          `adjustment would undercut allocated offers, ${promised} units of product ${product.id} are still promised to buyers and only expiry or withdrawal of those offers releases them`
        );
      }
      product.onHandQuantity = resulting;
      product.lastVerifiedAt = this.now;
      // A manager approving a count adjustment is a physical verification the
      // discrepant count alone never was, so confidence earns the promotion
      // recordInventoryCount deliberately withheld.
      product.confidence = "high";
      product.version += 1;
      this.appendMovement(product, proposal.delta, "count_adjustment");
      proposal.status = "applied";
    } else {
      proposal.status = "rejected";
    }
    proposal.version += 1;

    this.appendAudit({
      storeId: input.storeId,
      command: "approveStockAdjustmentV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("stock_adjustment_decided", input.storeId, {
      proposalId: proposal.id,
      decision: input.decision,
    });

    const result = ok({ ...proposal });
    this.writeIdempotent(
      "approveStockAdjustmentV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private approveAndPublishOffer(
    userId: string,
    input: PublishOfferV2Input
  ): Result<MarketplaceOfferV2> {
    this.applyLazyExpiry();

    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      allocation: {
        storeProductId: input.allocation.storeProductId,
        quantity: input.allocation.quantity,
        physicallySetAside: input.allocation.physicallySetAside,
      },
      title: input.title,
      category: input.category,
      imageUrl: input.imageUrl,
      contents: input.contents,
      offerPriceUzs: input.offerPriceUzs,
      referencePriceUzs: input.referencePriceUzs,
      pickupStart: input.pickupStart,
      pickupEnd: input.pickupEnd,
      allergens: input.allergens,
      dietaryBadges: input.dietaryBadges,
      pickupInstructions: input.pickupInstructions,
      cancellationPolicy: input.cancellationPolicy,
    });
    const replay = this.readIdempotent<MarketplaceOfferV2>(
      "approveAndPublishOfferV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const store = this.stores.get(input.storeId);
    if (!store) {
      return err("not_found", `store ${input.storeId} does not exist`);
    }

    const windowError = this.validatePickupWindow(
      input.pickupStart,
      input.pickupEnd
    );
    if (windowError) return windowError;

    if (input.offerPriceUzs <= 0) {
      return err("validation_failed", "offer price must be positive");
    }
    if (!Number.isInteger(input.allocation.quantity) || input.allocation.quantity < 1) {
      return err("validation_failed", "allocation quantity must be at least one");
    }

    const product = this.products.get(input.allocation.storeProductId);
    if (!product || product.storeId !== input.storeId) {
      return err(
        "not_found",
        `product ${input.allocation.storeProductId} is not in store ${input.storeId}`
      );
    }
    // Food safety rule, mirroring publish_offer_v2. The comparison is against
    // the last moment a buyer can collect, not against today. A product that
    // expires while the pickup window is still open would otherwise be handed
    // over after its expiry date.
    if (
      product.expiryDate !== null &&
      product.expiryDate < input.pickupEnd.slice(0, 10)
    ) {
      return err(
        "validation_failed",
        `product ${product.id} expires on ${product.expiryDate} before pickup ends ${input.pickupEnd}`
      );
    }

    const maxOfferable =
      product.confidence === "high"
        ? product.onHandQuantity - this.allocatedFor(product.id)
        : input.allocation.physicallySetAside
          ? input.allocation.quantity
          : 0;
    if (input.allocation.quantity > maxOfferable) {
      return err(
        "allocation_exceeded",
        `allocation of ${input.allocation.quantity} exceeds the offerable maximum of ${maxOfferable}`,
        { maxOfferableQuantity: maxOfferable }
      );
    }

    const offer: OfferRecord = {
      id: `offer-${this.nextSequence("offer")}`,
      version: 1,
      storeId: input.storeId,
      title: input.title,
      category: input.category,
      imageUrl: input.imageUrl,
      contents: [...input.contents],
      offerPriceUzs: input.offerPriceUzs,
      referencePriceUzs: input.referencePriceUzs,
      discountPercent: computeDiscountPercent(
        input.offerPriceUzs,
        input.referencePriceUzs
      ),
      quantityAvailable: input.allocation.quantity,
      pickupStart: input.pickupStart,
      pickupEnd: input.pickupEnd,
      allergens: [...input.allergens],
      dietaryBadges: [...input.dietaryBadges],
      pickupInstructions: input.pickupInstructions,
      cancellationPolicy: input.cancellationPolicy,
      lastVerifiedAt: product.lastVerifiedAt ?? this.now,
      status: "live",
      allocation: {
        storeProductId: input.allocation.storeProductId,
        quantity: input.allocation.quantity,
        physicallySetAside: input.allocation.physicallySetAside,
      },
    };
    this.offers.set(offer.id, offer);

    this.appendAudit({
      storeId: input.storeId,
      command: "approveAndPublishOfferV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("offer_published", input.storeId, {
      offerId: offer.id,
      quantity: offer.quantityAvailable,
    });

    const result = ok(this.projectOffer(offer));
    this.writeIdempotent(
      "approveAndPublishOfferV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private pauseOffer(
    userId: string,
    input: PauseOfferV2Input
  ): Result<MarketplaceOfferV2> {
    this.applyLazyExpiry();

    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      offerId: input.offerId,
    });
    const replay = this.readIdempotent<MarketplaceOfferV2>(
      "pauseOfferV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const offer = this.offers.get(input.offerId);
    if (!offer || offer.storeId !== input.storeId) {
      return err(
        "not_found",
        `offer ${input.offerId} is not in store ${input.storeId}`
      );
    }
    if (offer.version !== input.expectedVersion) {
      return err("version_conflict", `offer ${offer.id} moved on`, {
        currentVersion: offer.version,
      });
    }
    if (offer.status !== "live") {
      return err("invalid_state", `offer ${offer.id} is ${offer.status}`);
    }

    offer.status = "paused";
    offer.version += 1;

    this.appendAudit({
      storeId: input.storeId,
      command: "pauseOfferV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("offer_paused", input.storeId, { offerId: offer.id });

    const result = ok(this.projectOffer(offer));
    this.writeIdempotent(
      "pauseOfferV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private listSellerPickups(
    userId: string,
    storeId: string
  ): Result<SellerPickupV2[]> {
    this.applyLazyExpiry();
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    const pickups = [...this.reservations.values()]
      .filter((reservation) => reservation.storeId === storeId)
      .sort((left, right) => {
        const byTime = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return byTime !== 0 ? byTime : right.sequence - left.sequence;
      })
      .map((reservation) => this.projectPickup(reservation));
    return ok(pickups);
  }

  private fulfillReservation(
    userId: string,
    input: FulfillReservationV2Input
  ): Result<SellerPickupV2> {
    this.applyLazyExpiry();

    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      pickupCode: input.pickupCode,
    });
    const replay = this.readIdempotent<SellerPickupV2>(
      "fulfillReservationV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const reservation = [...this.reservations.values()].find(
      (candidate) =>
        candidate.storeId === input.storeId &&
        candidate.pickupCode === input.pickupCode
    );
    if (!reservation) {
      return err("not_found", "no reservation matches that pickup code");
    }
    // Checked against the clock rather than only against the status, so a
    // pickup code can never consume a unit after its hold expired even if the
    // lazy sweep above has not reached this row yet.
    if (Date.parse(reservation.holdExpiresAt) <= Date.parse(this.now)) {
      return err(
        "invalid_state",
        `reservation ${reservation.id} expired at ${reservation.holdExpiresAt}`
      );
    }
    if (reservation.status !== "held") {
      return err(
        "invalid_state",
        `reservation ${reservation.id} is ${reservation.status}`
      );
    }

    // Which stock the handover comes out of depends on how the offer was
    // published, mirroring fulfill_reservation_v2.
    //
    // A physically set aside offer is backed by units the seller pulled off
    // the shelf at publish time, which is why publication let its allocation
    // exceed what the ledger claimed. A ledger already down to zero is a stale
    // record here, not a reason to turn a buyer away, so the decrement floors
    // at zero and never fails. The movement row carries the delta that was
    // actually applied, 0 or -1, so the movement ledger keeps summing to the
    // true on hand.
    //
    // Every other offer is backed by the ledger alone, so a fulfillment that
    // would drive on hand negative is refused. The check runs before anything
    // is mutated, the fake has no transaction to roll back.
    const offer = this.offers.get(reservation.offerId);
    const product = offer
      ? this.products.get(offer.allocation.storeProductId) ?? null
      : null;
    let appliedDelta = 0;
    if (offer && product) {
      if (offer.allocation.physicallySetAside) {
        appliedDelta = product.onHandQuantity > 0 ? -1 : 0;
      } else {
        if (product.onHandQuantity - 1 < 0) {
          return err(
            "validation_failed",
            "fulfillment would make stock negative"
          );
        }
        appliedDelta = -1;
      }
    }

    reservation.status = "fulfilled";
    reservation.version += 1;
    reservation.updatedAt = this.now;

    if (product) {
      product.onHandQuantity += appliedDelta;
      product.version += 1;
      this.appendMovement(product, appliedDelta, "pickup_fulfilled");
    }

    this.appendAudit({
      storeId: input.storeId,
      command: "fulfillReservationV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("reservation_fulfilled", input.storeId, {
      reservationId: reservation.id,
      offerId: reservation.offerId,
    });

    const result = ok(this.projectPickup(reservation));
    this.writeIdempotent(
      "fulfillReservationV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private reportStockMismatch(
    userId: string,
    input: ReportStockMismatchV2Input
  ): Result<{ offer: MarketplaceOfferV2; exception: StoreExceptionV2 }> {
    this.applyLazyExpiry();

    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    const fingerprint = JSON.stringify({
      storeId: input.storeId,
      offerId: input.offerId,
      observedQuantity: input.observedQuantity,
      reason: input.reason,
    });
    const replay = this.readIdempotent<{
      offer: MarketplaceOfferV2;
      exception: StoreExceptionV2;
    }>("reportStockMismatchV2", input.storeId, input.idempotencyKey, fingerprint);
    if (replay) {
      return replay;
    }

    const offer = this.offers.get(input.offerId);
    if (!offer || offer.storeId !== input.storeId) {
      return err(
        "not_found",
        `offer ${input.offerId} is not in store ${input.storeId}`
      );
    }
    if (TERMINAL_OFFER_STATUSES.includes(offer.status)) {
      return err("invalid_state", `offer ${offer.id} is ${offer.status}`);
    }

    offer.status = "paused";
    offer.version += 1;

    for (const reservation of this.reservations.values()) {
      if (reservation.offerId !== offer.id) continue;
      if (reservation.status !== "held") continue;
      reservation.status = "failed_stock_mismatch";
      reservation.version += 1;
      reservation.updatedAt = this.now;
    }

    // One open stock mismatch per offer, mirroring the partial unique index in
    // SQL. A second report on the same offer under a different idempotency key
    // is a real case, a member reporting again after finding one more bag
    // missing, and it reuses the open row rather than growing a second one.
    // The stored message stays as first written, the SQL side does not rewrite
    // it either.
    let exception = this.findOpenMismatchFor(offer.id);
    if (!exception) {
      exception = {
        id: `exception-${this.nextSequence("exception")}`,
        storeId: input.storeId,
        kind: "stock_mismatch",
        message: `${input.reason} (observed ${input.observedQuantity})`,
        status: "open",
        resolutionNote: null,
        resolvedAt: null,
        relatedOfferId: offer.id,
        relatedStoreProductId: offer.allocation.storeProductId,
        createdAt: this.now,
      };
      this.exceptions.set(exception.id, exception);
    }

    this.appendAudit({
      storeId: input.storeId,
      command: "reportStockMismatchV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("offer_stock_mismatch", input.storeId, {
      offerId: offer.id,
      exceptionId: exception.id,
    });

    const result = ok({
      offer: this.projectOffer(offer),
      exception: { ...exception },
    });
    this.writeIdempotent(
      "reportStockMismatchV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private resolveStoreException(
    userId: string,
    input: ResolveStoreExceptionV2Input
  ): Result<StoreExceptionV2> {
    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    if (input.resolutionNote.trim().length === 0) {
      return err("validation_failed", "resolution note is required");
    }
    if (input.idempotencyKey.length === 0) {
      return err("validation_failed", "idempotency key is required");
    }

    const fingerprint = input.exceptionId;
    const replay = this.readIdempotent<StoreExceptionV2>(
      "resolveStoreExceptionV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) {
      return replay;
    }

    const exception = this.exceptions.get(input.exceptionId);
    if (!exception || exception.storeId !== input.storeId) {
      return err(
        "not_found",
        `exception ${input.exceptionId} is not in store ${input.storeId}`
      );
    }
    if (exception.status !== "open") {
      return err(
        "invalid_state",
        `exception ${input.exceptionId} is already ${exception.status}`
      );
    }

    exception.status = "resolved";
    exception.resolutionNote = input.resolutionNote;
    exception.resolvedAt = this.now;

    this.appendAudit({
      storeId: input.storeId,
      command: "resolveStoreExceptionV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("exception_resolved", input.storeId, {
      exceptionId: exception.id,
      relatedOfferId: exception.relatedOfferId,
      relatedStoreProductId: exception.relatedStoreProductId,
    });

    const result = ok({ ...exception });
    this.writeIdempotent(
      "resolveStoreExceptionV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private listStoreExceptions(
    userId: string,
    storeId: string
  ): Result<StoreExceptionV2[]> {
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    const found = [...this.exceptions.values()]
      .filter((exception) => exception.storeId === storeId)
      .map((exception) => ({ ...exception }));
    return ok(found);
  }

  private uploadImportBatch(
    userId: string,
    input: UploadImportBatchV2Input
  ): Result<ImportBatchV2> {
    const access = this.requireRole(input.storeId, userId, COUNT_ROLES);
    if (!access.ok) return access;

    if (input.filename.trim().length === 0) {
      return err("validation_failed", "filename is required");
    }
    if (input.idempotencyKey.length === 0) {
      return err("validation_failed", "idempotency key is required");
    }
    if (!Array.isArray(input.records) || input.records.length === 0) {
      return err("validation_failed", "at least one record is required");
    }

    for (const record of input.records) {
      if (!record || typeof record !== "object") {
        return err("validation_failed", "every record must be an object");
      }
      if (typeof record.rawName !== "string" || record.rawName.trim().length === 0) {
        return err("validation_failed", "every record needs a raw name");
      }
      if (
        record.rawQuantity !== undefined &&
        (!Number.isInteger(record.rawQuantity) ||
          record.rawQuantity < 0 ||
          record.rawQuantity > 2147483647)
      ) {
        return err(
          "validation_failed",
          "raw quantity must be a nonnegative integer"
        );
      }
      if (
        record.rawPrice !== undefined &&
        (typeof record.rawPrice !== "number" ||
          !Number.isFinite(record.rawPrice) ||
          record.rawPrice < 0)
      ) {
        return err("validation_failed", "raw price must be nonnegative");
      }
    }

    const normalizedRecords = input.records.map((record) => ({
      rawName: record.rawName,
      ...(record.rawBarcode === undefined
        ? {}
        : { rawBarcode: record.rawBarcode }),
      ...(record.rawQuantity === undefined
        ? {}
        : { rawQuantity: record.rawQuantity }),
      ...(record.rawPrice === undefined ? {} : { rawPrice: record.rawPrice }),
    }));
    const fingerprint = JSON.stringify({
      filename: input.filename,
      records: normalizedRecords,
    });
    const replay = this.readIdempotent<ImportBatchV2>(
      "uploadImportBatchV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) return replay;

    const sequence = this.nextSequence("importBatch");
    const batch: ImportBatchRecord = {
      id: `import-batch-${sequence}`,
      sequence,
      storeId: input.storeId,
      filename: input.filename,
      status: "needs_review",
      totalRecords: input.records.length,
      pendingRecords: input.records.length,
      createdAt: this.now,
    };
    this.importBatches.set(batch.id, batch);

    for (const source of input.records) {
      const rawBarcode = source.rawBarcode || null;
      const candidates = this.matchImportCandidates(
        input.storeId,
        source.rawName,
        rawBarcode
      );
      const stagedSequence = this.nextSequence("stagedRecord");
      const staged: StagedSourceRecord = {
        id: `staged-record-${stagedSequence}`,
        sequence: stagedSequence,
        batchId: batch.id,
        storeId: input.storeId,
        rawName: source.rawName,
        rawBarcode,
        rawQuantity: source.rawQuantity ?? null,
        rawPrice: source.rawPrice ?? null,
        matchStatus:
          candidates.length === 1
            ? "auto_matched"
            : candidates.length > 1
              ? "ambiguous"
              : "unmatched",
        matchedStoreProductId:
          candidates.length === 1 ? candidates[0].storeProductId : null,
        candidates,
        createdAt: this.now,
      };
      this.stagedRecords.set(staged.id, staged);
    }

    const result = ok(this.projectImportBatch(batch));
    this.writeIdempotent(
      "uploadImportBatchV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  private listImportBatches(
    userId: string,
    storeId: string
  ): Result<ImportBatchV2[]> {
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;

    return ok(
      [...this.importBatches.values()]
        .filter((batch) => batch.storeId === storeId)
        .sort((left, right) => right.sequence - left.sequence)
        .map((batch) => this.projectImportBatch(batch))
    );
  }

  private listStagedRecords(
    userId: string,
    storeId: string,
    batchId: string
  ): Result<StagedSourceRecordV2[]> {
    const access = this.requireRole(storeId, userId);
    if (!access.ok) return access;
    const batch = this.importBatches.get(batchId);
    if (!batch || batch.storeId !== storeId) {
      return err(
        "not_found",
        `import batch ${batchId} is not in store ${storeId}`
      );
    }

    return ok(
      [...this.stagedRecords.values()]
        .filter(
          (record) => record.storeId === storeId && record.batchId === batchId
        )
        .sort((left, right) => left.sequence - right.sequence)
        .map((record) => this.projectStagedRecord(record))
    );
  }

  private decideStagedRecord(
    userId: string,
    input: DecideStagedRecordV2Input
  ): Result<StagedSourceRecordV2> {
    const access = this.requireRole(input.storeId, userId, MANAGER_ROLES);
    if (!access.ok) return access;

    if (input.decision !== "approve" && input.decision !== "reject") {
      return err(
        "validation_failed",
        "decision must be approve or reject"
      );
    }
    if (input.decision === "reject" && input.targetStoreProductId !== null) {
      return err(
        "validation_failed",
        "a rejected record cannot have a target product"
      );
    }
    if (input.idempotencyKey.length === 0) {
      return err("validation_failed", "idempotency key is required");
    }

    const fingerprint = JSON.stringify({
      recordId: input.recordId,
      decision: input.decision,
      targetStoreProductId: input.targetStoreProductId,
    });
    const replay = this.readIdempotent<StagedSourceRecordV2>(
      "decideStagedRecordV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint
    );
    if (replay) return replay;

    const staged = this.stagedRecords.get(input.recordId);
    if (!staged || staged.storeId !== input.storeId) {
      return err(
        "not_found",
        `staged record ${input.recordId} is not in store ${input.storeId}`
      );
    }

    let targetProduct: ProductRecord | null = null;
    if (input.decision === "approve" && input.targetStoreProductId !== null) {
      targetProduct = this.products.get(input.targetStoreProductId) ?? null;
      if (!targetProduct || targetProduct.storeId !== input.storeId) {
        return err(
          "not_found",
          `target product ${input.targetStoreProductId} is not in store ${input.storeId}`
        );
      }
    }

    const batch = this.importBatches.get(staged.batchId);
    if (!batch || batch.storeId !== input.storeId) {
      return err(
        "not_found",
        `import batch for staged record ${input.recordId} is missing`
      );
    }
    if (staged.matchStatus === "approved" || staged.matchStatus === "rejected") {
      return err(
        "invalid_state",
        `staged record ${input.recordId} is already ${staged.matchStatus}`
      );
    }
    if (batch.pendingRecords <= 0) {
      return err(
        "invalid_state",
        `import batch ${batch.id} has no pending records`
      );
    }

    if (input.decision === "approve" && targetProduct === null) {
      const duplicateAlias = [...this.productAliases.values()].some(
        (alias) =>
          alias.storeId === input.storeId &&
          alias.alias.toLowerCase() === staged.rawName.toLowerCase()
      );
      if (duplicateAlias) {
        return err(
          "validation_failed",
          "raw name is already an alias in this store"
        );
      }

      const productId = this.addProduct({
        storeId: input.storeId,
        productName: staged.rawName,
        barcode: staged.rawBarcode,
        onHandQuantity: 0,
        confidence: "low",
      });
      targetProduct = this.products.get(productId) as ProductRecord;
      const alias: ProductAliasRecord = {
        id: `product-alias-${this.nextSequence("productAlias")}`,
        storeId: input.storeId,
        storeProductId: productId,
        alias: staged.rawName,
        approved: true,
      };
      this.productAliases.set(alias.id, alias);
    }

    if (input.decision === "approve" && targetProduct) {
      if (staged.rawQuantity !== null) {
        const observation: InventoryObservationRecord = {
          id: `inventory-observation-${this.nextSequence(
            "inventoryObservation"
          )}`,
          storeId: input.storeId,
          storeProductId: targetProduct.id,
          stagedSourceRecordId: staged.id,
          observedQuantity: staged.rawQuantity,
          confidence: "low",
          createdAt: this.now,
        };
        this.inventoryObservations.set(observation.id, observation);

        targetProduct.confidence = "low";
        targetProduct.lastVerifiedAt = this.now;
        targetProduct.version += 1;

        if (staged.rawQuantity !== targetProduct.onHandQuantity) {
          const proposal: StockAdjustmentProposalV2 = {
            id: `proposal-${this.nextSequence("proposal")}`,
            storeId: input.storeId,
            storeProductId: targetProduct.id,
            productName: targetProduct.productName,
            currentQuantity: targetProduct.onHandQuantity,
            proposedQuantity: staged.rawQuantity,
            delta: staged.rawQuantity - targetProduct.onHandQuantity,
            reason: "count",
            status: "pending",
            createdByRole: access.value.role,
            createdAt: this.now,
            version: 1,
          };
          this.proposals.set(proposal.id, proposal);
        }
      }

      staged.matchStatus = "approved";
      staged.matchedStoreProductId = targetProduct.id;
    } else {
      staged.matchStatus = "rejected";
      staged.matchedStoreProductId = null;
    }

    batch.pendingRecords -= 1;
    batch.status = batch.pendingRecords === 0 ? "completed" : "needs_review";

    this.appendAudit({
      storeId: input.storeId,
      command: "decideStagedRecordV2",
      actorUserId: userId,
      installationRef: null,
    });
    this.appendOutbox("staged_record_decided", input.storeId, {
      batchId: batch.id,
      recordId: staged.id,
      decision: input.decision,
      targetStoreProductId: staged.matchedStoreProductId,
    });

    const result = ok(this.projectStagedRecord(staged));
    this.writeIdempotent(
      "decideStagedRecordV2",
      input.storeId,
      input.idempotencyKey,
      fingerprint,
      result
    );
    return result;
  }

  // Internals.

  private guard<T>(run: () => Result<T>): Result<T> {
    try {
      return run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "unexpected failure";
      return err("unknown", message);
    }
  }

  private nextSequence(name: string): number {
    const next = (this.counters.get(name) ?? 0) + 1;
    this.counters.set(name, next);
    return next;
  }

  private requireRole(
    storeId: string,
    userId: string,
    allowed?: readonly StoreRole[]
  ): Result<MembershipRecord> {
    const membership = this.memberships.get(`${storeId}::${userId}`);
    if (!membership) {
      return err("forbidden", `user ${userId} is not a member of ${storeId}`);
    }
    if (allowed && !allowed.includes(membership.role)) {
      return err(
        "forbidden",
        `role ${membership.role} may not run this command`
      );
    }
    return ok(membership);
  }

  private validatePickupWindow(
    pickupStart: string,
    pickupEnd: string
  ): Result<never> | null {
    const startMs = Date.parse(pickupStart);
    const endMs = Date.parse(pickupEnd);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return err("validation_failed", "pickup window is not a valid timestamp");
    }
    if (endMs <= startMs) {
      return err("validation_failed", "pickup end must be after pickup start");
    }
    if (startMs <= Date.parse(this.now)) {
      return err("validation_failed", "pickup window must be in the future");
    }
    return null;
  }

  /**
   * Offers whose pickup window has closed become expired the next time anything
   * reads them, and every reservation past its hold expiry becomes
   * expired_no_show in the same pass. Expiry is derived from the clock rather
   * than from a command, so it writes no audit entry, emits no outbox event and
   * does not bump the offer version. Expired is terminal on both sides and
   * never returns to an active status.
   *
   * The two halves have to move together. An offer that expires while its
   * reservations stay held would drop those units out of the allocation
   * accounting (the offer is terminal, so it contributes nothing) while the
   * pickup codes still looked fulfillable, which is how a buyer could be
   * handed a unit the store had already offered to somebody else.
   */
  private applyLazyExpiry(): void {
    const nowMs = Date.parse(this.now);
    for (const offer of this.offers.values()) {
      if (TERMINAL_OFFER_STATUSES.includes(offer.status)) continue;
      if (Date.parse(offer.pickupEnd) <= nowMs) {
        offer.status = "expired";
      }
    }
    // Expired holds release their unit back to the offer, exactly as the SQL
    // sweep does. Releases are grouped per offer so one offer takes one
    // quantity update and one version bump per released unit, the count is
    // capped at the offer's total so a double sweep can never invent stock,
    // and a sold out offer whose window is still open returns to live. The
    // offer version does move here, only the offer status flip above is
    // treated as pure derivation.
    const released = new Map<string, number>();
    for (const reservation of this.reservations.values()) {
      if (reservation.status !== "held") continue;
      if (Date.parse(reservation.holdExpiresAt) > nowMs) continue;
      reservation.status = "expired_no_show";
      reservation.version += 1;
      reservation.updatedAt = this.now;
      released.set(reservation.offerId, (released.get(reservation.offerId) ?? 0) + 1);
    }

    for (const offerId of [...released.keys()].sort()) {
      const offer = this.offers.get(offerId);
      if (!offer) continue;
      const count = released.get(offerId) ?? 0;
      offer.quantityAvailable = Math.min(
        offer.quantityAvailable + count,
        offer.allocation.quantity
      );
      offer.version += count;
      if (offer.status === "sold_out" && Date.parse(offer.pickupEnd) > nowMs) {
        offer.status = "live";
      }
    }
  }

  private findOpenMismatchFor(offerId: string): StoreExceptionV2 | null {
    for (const exception of this.exceptions.values()) {
      if (
        exception.status === "open" &&
        exception.kind === "stock_mismatch" &&
        exception.relatedOfferId === offerId
      ) {
        return exception;
      }
    }
    return null;
  }

  private hasOpenMismatchFor(offerId: string): boolean {
    return this.findOpenMismatchFor(offerId) !== null;
  }

  /**
   * Reservations that still tie up a unit of an offer. Held reservations always
   * do. Reservations failed by a stock mismatch keep their unit encumbered while
   * the mismatch exception is open, because the physical truth of those units is
   * unknown until somebody resolves the exception. Without that rule a mismatch
   * would hand the missing units straight back to the offerable pool.
   */
  private heldCountFor(offerId: string): number {
    let held = 0;
    for (const reservation of this.reservations.values()) {
      if (reservation.offerId !== offerId) continue;
      if (reservation.status === "held") held += 1;
    }
    return held;
  }

  /**
   * Reservations this offer failed with a stock mismatch while that mismatch
   * exception is still open. The physical truth of those units is unknown
   * until somebody resolves the exception, so they stay out of the offerable
   * pool. This term survives the offer reaching a terminal status, matching
   * the SQL ceiling, where the failed mismatch count is added outside the
   * status case rather than inside it. Letting an expiry quietly hand those
   * units back would mean a mismatch could be walked off by waiting.
   */
  private failedMismatchCountFor(offerId: string): number {
    if (!this.hasOpenMismatchFor(offerId)) return 0;
    let failed = 0;
    for (const reservation of this.reservations.values()) {
      if (reservation.offerId !== offerId) continue;
      if (reservation.status === "failed_stock_mismatch") failed += 1;
    }
    return failed;
  }

  private encumberedCountFor(offerId: string): number {
    return this.heldCountFor(offerId) + this.failedMismatchCountFor(offerId);
  }

  /**
   * Units of a product that some offer still has a claim on. Units sitting on
   * the shelf for a non terminal offer and units encumbered by a reservation
   * both count, so fulfilment releases the allocation at the same moment it
   * removes the unit from stock. Every non terminal offer on the product
   * contributes, so two live offers on one product consume the pool together,
   * and open mismatch units keep counting even after their offer expires.
   *
   * ledgerBackedOnly narrows the sum to offers that are NOT physically set
   * aside, which is what an inventory adjustment has to respect. A set aside
   * offer's units left the ledger when the seller pulled them off the shelf,
   * so they neither consume nor protect the on hand number.
   */
  private allocatedFor(
    storeProductId: string,
    options?: { ledgerBackedOnly?: boolean }
  ): number {
    let allocated = 0;
    for (const offer of this.offers.values()) {
      if (offer.allocation.storeProductId !== storeProductId) continue;
      if (options?.ledgerBackedOnly && offer.allocation.physicallySetAside) {
        continue;
      }
      if (!TERMINAL_OFFER_STATUSES.includes(offer.status)) {
        allocated += offer.quantityAvailable + this.heldCountFor(offer.id);
      }
      allocated += this.failedMismatchCountFor(offer.id);
    }
    return allocated;
  }

  private hasOpenExceptionFor(storeProductId: string): boolean {
    for (const exception of this.exceptions.values()) {
      if (
        exception.status === "open" &&
        exception.relatedStoreProductId === storeProductId
      ) {
        return true;
      }
    }
    return false;
  }

  private matchImportCandidates(
    storeId: string,
    rawName: string,
    rawBarcode: string | null
  ): StagedSourceRecordV2["candidates"] {
    const products = [...this.products.values()].filter(
      (product) => product.storeId === storeId
    );
    const barcodeMatches = rawBarcode
      ? products.filter((product) => product.barcode === rawBarcode)
      : [];
    const aliasMatches =
      barcodeMatches.length === 0
        ? [...this.productAliases.values()]
            .filter(
              (alias) =>
                alias.storeId === storeId &&
                alias.approved &&
                alias.alias.toLowerCase() === rawName.toLowerCase()
            )
            .map((alias) => this.products.get(alias.storeProductId))
            .filter((product): product is ProductRecord => Boolean(product))
        : [];
    const nameMatches =
      barcodeMatches.length === 0 && aliasMatches.length === 0
        ? products.filter(
            (product) =>
              product.productName.toLowerCase() === rawName.toLowerCase()
          )
        : [];
    const matches =
      barcodeMatches.length > 0
        ? barcodeMatches
        : aliasMatches.length > 0
          ? aliasMatches
          : nameMatches;
    const reason =
      barcodeMatches.length > 0
        ? "barcode"
        : aliasMatches.length > 0
          ? "alias"
          : "product_name";
    return matches
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((product) => ({
        storeProductId: product.id,
        productName: product.productName,
        reason,
      }));
  }

  /**
   * Idempotency keys are scoped to the principal that owns them, a store for
   * seller commands and an installation for buyer commands, so one caller can
   * never replay another caller stored result. Only successful results are
   * stored, which leaves a failed command free to be retried once the caller
   * has fixed whatever was wrong.
   *
   * Stored results are cloned on the way in and on the way out, so a replay is
   * equal in content to the first response without handing every caller the same
   * mutable object.
   *
   * reserveOfferV2 is the one command that does not simply hand the stored
   * payload back. Its replay path re-projects the live reservation row and
   * blanks the raw pickup code, see reserveOffer for why.
   */
  private readIdempotent<T>(
    command: string,
    scope: string,
    key: string,
    fingerprint: string
  ): Result<T> | null {
    const stored = this.idempotency.get(`${command}::${scope}::${key}`);
    if (!stored) return null;
    if (stored.fingerprint !== fingerprint) {
      return err(
        "idempotency_conflict",
        `${command} key ${key} was already used with different input`
      );
    }
    return cloneResult(stored.result) as Result<T>;
  }

  private writeIdempotent(
    command: string,
    scope: string,
    key: string,
    fingerprint: string,
    result: Result<unknown>
  ): void {
    if (!result.ok) return;
    this.idempotency.set(`${command}::${scope}::${key}`, {
      fingerprint,
      result: cloneResult(result),
    });
  }

  private appendAudit(entry: Omit<AuditEntryV2, "id" | "at">): void {
    this.auditEntries.push({
      id: `audit-${this.nextSequence("audit")}`,
      at: this.now,
      ...entry,
    });
  }

  private appendOutbox(
    name: string,
    storeId: string,
    payload: Record<string, unknown>
  ): void {
    this.outboxEvents.push({
      id: `outbox-${this.nextSequence("outbox")}`,
      name,
      storeId,
      at: this.now,
      payload,
    });
  }

  private appendMovement(
    product: ProductRecord,
    delta: number,
    reason: string
  ): void {
    this.movements.push({
      id: `movement-${this.nextSequence("movement")}`,
      storeId: product.storeId,
      storeProductId: product.id,
      delta,
      reason,
      at: this.now,
    });
  }

  private projectOffer(offer: OfferRecord): MarketplaceOfferV2 {
    const store = this.stores.get(offer.storeId);
    return {
      id: offer.id,
      version: offer.version,
      storeId: offer.storeId,
      storeName: store?.name ?? "Unknown store",
      storeAddress: store?.address ?? "",
      latitude: store?.latitude ?? 0,
      longitude: store?.longitude ?? 0,
      title: offer.title,
      category: offer.category,
      imageUrl: offer.imageUrl,
      contents: [...offer.contents],
      offerPriceUzs: offer.offerPriceUzs,
      referencePriceUzs: offer.referencePriceUzs,
      discountPercent: offer.discountPercent,
      quantityAvailable: offer.quantityAvailable,
      pickupStart: offer.pickupStart,
      pickupEnd: offer.pickupEnd,
      timezone: "Asia/Tashkent",
      allergens: [...offer.allergens],
      dietaryBadges: [...offer.dietaryBadges],
      pickupInstructions: offer.pickupInstructions,
      cancellationPolicy: offer.cancellationPolicy,
      lastVerifiedAt: offer.lastVerifiedAt,
      status: offer.status,
    };
  }

  private projectReservation(
    reservation: ReservationRecord
  ): BuyerReservationV2 {
    return {
      id: reservation.id,
      version: reservation.version,
      offerId: reservation.offerId,
      status: reservation.status,
      quantity: 1,
      offerSnapshot: {
        ...reservation.offerSnapshot,
        contents: [...reservation.offerSnapshot.contents],
        allergens: [...reservation.offerSnapshot.allergens],
        dietaryBadges: [...reservation.offerSnapshot.dietaryBadges],
      },
      pickupCodeHint: reservation.pickupCode.slice(-2),
      holdExpiresAt: reservation.holdExpiresAt,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }

  private projectPickup(reservation: ReservationRecord): SellerPickupV2 {
    const snapshot = reservation.offerSnapshot;
    return {
      reservationId: reservation.id,
      offerId: reservation.offerId,
      offerTitle: snapshot.title,
      status: reservation.status,
      pickupCodeHint: reservation.pickupCode.slice(-2),
      holdExpiresAt: reservation.holdExpiresAt,
      pickupStart: snapshot.pickupStart,
      pickupEnd: snapshot.pickupEnd,
      createdAt: reservation.createdAt,
      version: reservation.version,
    };
  }

  private projectInventory(product: ProductRecord): InventorySummaryV2 {
    const allocated = this.allocatedFor(product.id);
    const maxOfferable =
      product.confidence === "high"
        ? Math.max(0, product.onHandQuantity - allocated)
        : 0;
    return {
      storeProductId: product.id,
      storeId: product.storeId,
      productName: product.productName,
      barcode: product.barcode,
      category: product.category,
      onHandQuantity: product.onHandQuantity,
      confidence: product.confidence,
      lastVerifiedAt: product.lastVerifiedAt,
      maxOfferableQuantity: maxOfferable,
      allocatedQuantity: allocated,
      expiryDate: product.expiryDate,
      hasOpenExceptions: this.hasOpenExceptionFor(product.id),
      version: product.version,
    };
  }

  private projectImportBatch(batch: ImportBatchRecord): ImportBatchV2 {
    return {
      id: batch.id,
      storeId: batch.storeId,
      filename: batch.filename,
      status: batch.status,
      totalRecords: batch.totalRecords,
      pendingRecords: batch.pendingRecords,
      createdAt: batch.createdAt,
    };
  }

  private projectStagedRecord(
    record: StagedSourceRecord
  ): StagedSourceRecordV2 {
    return {
      id: record.id,
      batchId: record.batchId,
      storeId: record.storeId,
      rawName: record.rawName,
      rawBarcode: record.rawBarcode,
      rawQuantity: record.rawQuantity,
      rawPrice: record.rawPrice,
      matchStatus: record.matchStatus,
      matchedStoreProductId: record.matchedStoreProductId,
      candidates: record.candidates.map((candidate) => ({ ...candidate })),
      createdAt: record.createdAt,
    };
  }
}

/**
 * Public discount rule. A discount only exists when a positive reference price
 * is supplied, otherwise the field stays null.
 */
export function computeDiscountPercent(
  offerPriceUzs: number,
  referencePriceUzs: number | null
): number | null {
  if (typeof referencePriceUzs !== "number" || referencePriceUzs <= 0) {
    return null;
  }
  return Math.round(
    ((referencePriceUzs - offerPriceUzs) * 100) / referencePriceUzs
  );
}
