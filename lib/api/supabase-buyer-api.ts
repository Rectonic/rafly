/**
 * The Supabase backed buyer facade.
 *
 * Reads go through marketplace_offers_v2_public, the redacted view, and never
 * through offers_v2. Writes go through the two buyer RPCs. Nothing here throws:
 * every path returns a Result, and every failure, whether it came back in the
 * PostgREST error field or was raised by the transport, is mapped through the
 * same error mapper.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BuyerMarketplaceApiV2 } from "@/lib/api/buyer-api";
import {
  commandErrorFrom,
  mapPublicOfferRow,
  mapReservationRow,
  type PublicOfferRow,
  type ReservationRow,
} from "@/lib/api/mappers";
import {
  generatePickupCode,
  pickupCodeHint,
  sha256Hex,
} from "@/lib/api/pickup-code";
import type {
  BuyerReservationV2,
  CancelReservationV2Input,
  MarketplaceOfferV2,
  ReserveOfferV2Input,
  ReserveOfferV2Result,
  Result,
} from "@/lib/contracts";
import { err, ok } from "@/lib/contracts";

const PUBLIC_VIEW = "marketplace_offers_v2_public";

interface ReserveRpcResult {
  reservation: ReservationRow;
  pickup_code: string | null;
  replayed: boolean;
}

export function makeSupabaseBuyerApi(
  client: SupabaseClient
): BuyerMarketplaceApiV2 {
  return {
    async listMarketplaceOffersV2(): Promise<Result<MarketplaceOfferV2[]>> {
      try {
        const { data, error } = await client
          .from(PUBLIC_VIEW)
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          return commandErrorFrom(error);
        }
        return ok(
          ((data ?? []) as PublicOfferRow[]).map((row) =>
            mapPublicOfferRow(row)
          )
        );
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async getMarketplaceOfferV2(
      offerId: string
    ): Promise<Result<MarketplaceOfferV2>> {
      try {
        const { data, error } = await client
          .from(PUBLIC_VIEW)
          .select("*")
          .eq("id", offerId)
          .maybeSingle();

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          // The view only carries live and sold out offers whose pickup
          // window is still open, so an offer that has been paused, expired,
          // withdrawn or deleted is indistinguishable from one that never
          // existed. Both read as not_found to a buyer.
          return err("not_found", `offer ${offerId} is not available`);
        }
        return ok(mapPublicOfferRow(data as PublicOfferRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async reserveOfferV2(
      input: ReserveOfferV2Input
    ): Promise<Result<ReserveOfferV2Result>> {
      if (input.quantity !== 1) {
        return err(
          "validation_failed",
          "a reservation covers exactly one unit in the beta"
        );
      }

      try {
        // The plaintext code never leaves this function except in the
        // response. The RPC recomputes the digest and checks the hint against
        // the last two characters, so a client cannot register a hash for a
        // code it did not generate.
        const pickupCode = generatePickupCode();

        const { data, error } = await client.rpc("reserve_offer_v2", {
          p_offer_id: input.offerId,
          p_client_reservation_id: input.clientReservationId,
          p_installation_id: input.installationId,
          p_expected_offer_version: input.expectedOfferVersion,
          p_pickup_code: pickupCode,
          p_pickup_code_hash: sha256Hex(pickupCode),
          p_pickup_code_hint: pickupCodeHint(pickupCode),
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "reserve returned no result");
        }

        const result = data as ReserveRpcResult;
        // A clientReservationId belongs to one offer. The RPC replays by
        // installation and client id alone, so a client that reuses an id for
        // a different offer would otherwise be handed somebody else's
        // reservation and told it succeeded. That is the idempotency_conflict
        // case, and the offer id on the replayed row is what proves it.
        if (result.reservation.offer_id !== input.offerId) {
          return err(
            "idempotency_conflict",
            `client reservation id ${input.clientReservationId} already belongs to offer ${result.reservation.offer_id}`
          );
        }
        return ok({
          reservation: mapReservationRow(result.reservation),
          // Null on replay, and passed through exactly as it arrived. The
          // raw code is issued once, so a caller that already stored it keeps
          // the only copy and a caller that lost it cannot get it back.
          pickupCode: result.pickup_code,
        });
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async cancelReservationV2(
      input: CancelReservationV2Input
    ): Promise<Result<BuyerReservationV2>> {
      try {
        const { data, error } = await client.rpc("cancel_reservation_v2", {
          p_reservation_id: input.reservationId,
          p_installation_id: input.installationId,
          p_idempotency_key: input.idempotencyKey,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        if (!data) {
          return err("unknown", "cancel returned no reservation");
        }
        return ok(mapReservationRow(data as ReservationRow));
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },

    async getBuyerReservationsV2(
      installationId: string
    ): Promise<Result<BuyerReservationV2[]>> {
      try {
        const { data, error } = await client.rpc("get_buyer_reservations_v2", {
          p_installation_id: installationId,
        });

        if (error) {
          return commandErrorFrom(error);
        }
        return ok(
          ((data ?? []) as ReservationRow[]).map((row) =>
            mapReservationRow(row)
          )
        );
      } catch (thrown) {
        return commandErrorFrom(thrown);
      }
    },
  };
}
