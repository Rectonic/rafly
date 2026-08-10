/**
 * The Supabase backed seller facade.
 *
 * Every mutation is an RPC. The two direct table reads left are
 * store_memberships joined to stores, which row level security already scopes
 * to the caller, and the store row used to enrich a raw offer.
 *
 * Raw offers_v2 rows come back from publish, pause and mismatch. They carry
 * internal columns and no store details, so each one is passed through
 * mapSellerOfferRow together with the store row before it is returned. That is
 * the redaction and enrichment step, and it is the reason those three commands
 * cost one extra read.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SellerStoreApiV2 } from "@/lib/api/seller-api";
import {
  commandErrorFrom,
  mapExceptionRow,
  mapInventoryRow,
  mapMembershipRow,
  mapProposalRow,
  mapSellerOfferRow,
  mapSellerPickupRow,
  toStableUuid,
  toStoreEnrichment,
  type ExceptionRow,
  type InventoryRow,
  type ProposalRow,
  type RawOfferRow,
  type SellerPickupRow,
  type StoreEnrichment,
  type StoreRow,
} from "@/lib/api/mappers";
import type {
  ApproveStockAdjustmentV2Input,
  FulfillReservationV2Input,
  InventorySummaryV2,
  MarketplaceOfferV2,
  PauseOfferV2Input,
  PublishOfferV2Input,
  RecordInventoryCountV2Input,
  ReportStockMismatchV2Input,
  ResolveStoreExceptionV2Input,
  Result,
  SellerPickupV2,
  StockAdjustmentProposalV2,
  StoreExceptionV2,
  StoreMembershipV2,
} from "@/lib/contracts";
import { err, ok } from "@/lib/contracts";

interface MembershipJoinRow {
  store_id: string;
  role: StoreMembershipV2["role"];
  stores:
    | {
        name: string;
        pilot_mode_enabled: boolean;
        shop_seller_beta_enabled: boolean;
      }
    | {
        name: string;
        pilot_mode_enabled: boolean;
        shop_seller_beta_enabled: boolean;
      }[]
    | null;
}

interface MismatchRpcResult {
  offer: RawOfferRow;
  exception: ExceptionRow;
}

/** PostgREST types an embedded to-one relation as an object or an array. */
function firstEmbedded<T>(value: T | T[] | null): T | null {
  if (value === null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function makeSupabaseSellerApi(
  client: SupabaseClient
): SellerStoreApiV2 {
  /**
   * The store row the raw offer rows do not carry. Read on demand rather than
   * cached, so a renamed or relocated store shows up on the next publish
   * instead of on the next app launch.
   */
  async function readStore(storeId: string): Promise<Result<StoreEnrichment>> {
    const { data, error } = await client
      .from("stores")
      .select("id, name, address, latitude, longitude")
      .eq("id", storeId)
      .maybeSingle();

    if (error) {
      return commandErrorFrom(error);
    }
    if (!data) {
      return err("not_found", `store ${storeId} is not visible to you`);
    }
    return ok(toStoreEnrichment(data as StoreRow));
  }

  /**
   * Product names for a set of proposals. The proposals table stores only the
   * product id, and every seller screen needs the name next to the numbers.
   */
  async function readProductNames(
    storeId: string,
    productIds: string[]
  ): Promise<Result<Map<string, string>>> {
    const unique = [...new Set(productIds)];
    if (unique.length === 0) {
      return ok(new Map());
    }

    const { data, error } = await client
      .from("store_products")
      .select("id, product_name")
      .eq("store_id", storeId)
      .in("id", unique);

    if (error) {
      return commandErrorFrom(error);
    }

    const names = new Map<string, string>();
    for (const row of (data ?? []) as { id: string; product_name: string }[]) {
      names.set(row.id, row.product_name);
    }
    return ok(names);
  }

  return {
    async getMyStoreMembershipsV2(): Promise<Result<StoreMembershipV2[]>> {
      try {
        const { data, error } = await client
          .from("store_memberships")
          .select(
            "store_id, role, stores!inner(name, pilot_mode_enabled, shop_seller_beta_enabled)"
          );

        if (error) {
          return commandErrorFrom(error);
        }

        const memberships: StoreMembershipV2[] = [];
        for (const row of (data ?? []) as unknown as MembershipJoinRow[]) {
          const store = firstEmbedded(row.stores);
          if (!store) {
            continue;
          }
          memberships.push(
            mapMembershipRow({
              store_id: row.store_id,
              store_name: store.name,
              role: row.role,
              pilot_mode_enabled: store.pilot_mode_enabled,
              shop_seller_beta_enabled: store.shop_seller_beta_enabled,
            })
          );
        }
        return ok(memberships);
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async listStoreOffersV2(
      storeId: string
    ): Promise<Result<MarketplaceOfferV2[]>> {
      try {
        const { data, error } = await client.rpc("list_store_offers_v2", {
          p_store_id: storeId,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        const rows = (data ?? []) as RawOfferRow[];
        if (rows.length === 0) {
          return ok([]);
        }

        const store = await readStore(storeId);
        if (!store.ok) {
          return store;
        }
        return ok(rows.map((row) => mapSellerOfferRow(row, store.value)));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async listStoreInventoryV2(
      storeId: string
    ): Promise<Result<InventorySummaryV2[]>> {
      try {
        const { data, error } = await client.rpc("list_store_inventory_v2", {
          p_store_id: storeId,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        return ok(((data ?? []) as InventoryRow[]).map(mapInventoryRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async recordInventoryCountV2(
      input: RecordInventoryCountV2Input
    ): Promise<Result<StockAdjustmentProposalV2[]>> {
      try {
        const { data, error } = await client.rpc("record_inventory_count_v2", {
          p_store_id: input.storeId,
          // The column is a uuid and the contract field is a free string, so
          // anything that is not already a uuid is derived from one. Stable
          // derivation is what keeps the replay behaviour intact.
          p_count_session_id: toStableUuid(input.countSessionId),
          p_lines: input.lines.map((line) => ({
            storeProductId: line.storeProductId,
            observedQuantity: line.observedQuantity,
          })),
        });

        if (error) {
          return commandErrorFrom(error);
        }

        const rows = (data ?? []) as ProposalRow[];
        const names = await readProductNames(
          input.storeId,
          rows.map((row) => row.store_product_id)
        );
        if (!names.ok) {
          return names;
        }
        return ok(
          rows.map((row) =>
            mapProposalRow(row, names.value.get(row.store_product_id) ?? "")
          )
        );
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async approveStockAdjustmentV2(
      input: ApproveStockAdjustmentV2Input
    ): Promise<Result<StockAdjustmentProposalV2>> {
      try {
        const { data, error } = await client.rpc(
          "approve_stock_adjustment_v2",
          {
            p_store_id: input.storeId,
            p_proposal_id: input.proposalId,
            p_decision: input.decision,
            p_idempotency_key: input.idempotencyKey,
            p_expected_version: input.expectedVersion,
          }
        );

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "the decision returned no proposal");
        }

        const row = data as ProposalRow;
        const names = await readProductNames(input.storeId, [
          row.store_product_id,
        ]);
        if (!names.ok) {
          return names;
        }
        return ok(
          mapProposalRow(row, names.value.get(row.store_product_id) ?? "")
        );
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async approveAndPublishOfferV2(
      input: PublishOfferV2Input
    ): Promise<Result<MarketplaceOfferV2>> {
      try {
        // storeId and the key travel as their own parameters. What stays in
        // p_input is the material content of the offer, and that is exactly
        // what the RPC fingerprints, so reusing a key after editing the offer
        // is caught as an idempotency_conflict.
        const { data, error } = await client.rpc("publish_offer_v2", {
          p_store_id: input.storeId,
          p_idempotency_key: input.idempotencyKey,
          p_input: {
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
          },
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "publish returned no offer");
        }

        const store = await readStore(input.storeId);
        if (!store.ok) {
          return store;
        }
        return ok(mapSellerOfferRow(data as RawOfferRow, store.value));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async pauseOfferV2(
      input: PauseOfferV2Input
    ): Promise<Result<MarketplaceOfferV2>> {
      try {
        const { data, error } = await client.rpc("pause_offer_v2", {
          p_store_id: input.storeId,
          p_offer_id: input.offerId,
          p_idempotency_key: input.idempotencyKey,
          p_expected_version: input.expectedVersion,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "pause returned no offer");
        }

        const store = await readStore(input.storeId);
        if (!store.ok) {
          return store;
        }
        return ok(mapSellerOfferRow(data as RawOfferRow, store.value));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async listSellerPickupsV2(
      storeId: string
    ): Promise<Result<SellerPickupV2[]>> {
      try {
        const { data, error } = await client.rpc("list_seller_pickups_v2", {
          p_store_id: storeId,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        return ok(((data ?? []) as SellerPickupRow[]).map(mapSellerPickupRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async fulfillReservationV2(
      input: FulfillReservationV2Input
    ): Promise<Result<SellerPickupV2>> {
      try {
        const { data, error } = await client.rpc("fulfill_reservation_v2", {
          p_store_id: input.storeId,
          p_pickup_code: input.pickupCode,
          p_idempotency_key: input.idempotencyKey,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "fulfilment returned no pickup");
        }
        return ok(mapSellerPickupRow(data as SellerPickupRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async reportStockMismatchV2(
      input: ReportStockMismatchV2Input
    ): Promise<
      Result<{ offer: MarketplaceOfferV2; exception: StoreExceptionV2 }>
    > {
      try {
        const { data, error } = await client.rpc("report_stock_mismatch_v2", {
          p_store_id: input.storeId,
          p_offer_id: input.offerId,
          p_observed_quantity: input.observedQuantity,
          p_reason: input.reason,
          p_idempotency_key: input.idempotencyKey,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "the mismatch report returned no result");
        }

        const result = data as MismatchRpcResult;
        const store = await readStore(input.storeId);
        if (!store.ok) {
          return store;
        }
        return ok({
          offer: mapSellerOfferRow(result.offer, store.value),
          exception: mapExceptionRow(result.exception),
        });
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async listStoreExceptionsV2(
      storeId: string
    ): Promise<Result<StoreExceptionV2[]>> {
      try {
        const { data, error } = await client.rpc("list_store_exceptions_v2", {
          p_store_id: storeId,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        return ok(((data ?? []) as ExceptionRow[]).map(mapExceptionRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async resolveStoreExceptionV2(
      input: ResolveStoreExceptionV2Input
    ): Promise<Result<StoreExceptionV2>> {
      try {
        const { data, error } = await client.rpc("resolve_store_exception_v2", {
          p_store_id: input.storeId,
          p_exception_id: input.exceptionId,
          p_resolution_note: input.resolutionNote,
          p_idempotency_key: input.idempotencyKey,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "exception resolution returned no result");
        }
        return ok(mapExceptionRow(data as ExceptionRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },
  };
}
