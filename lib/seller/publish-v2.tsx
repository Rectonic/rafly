import { useCallback, useRef, useState } from "react";

import type { CommandError, MarketplaceOfferV2, PublishOfferV2Input, Result } from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export type PublishStatusV2 = "idle" | "submitting" | "published" | "error";
export type PauseStatusV2 = "idle" | "in-flight" | "paused" | "error";

export type PublishDraftInputV2 = Omit<PublishOfferV2Input, "storeId" | "idempotencyKey">;

export interface UsePublishOfferV2Result {
  offer: MarketplaceOfferV2 | null;
  pause: () => Promise<Result<MarketplaceOfferV2> | null>;
  pauseError: CommandError | null;
  pauseStatus: PauseStatusV2;
  publish: (input: PublishDraftInputV2) => Promise<Result<MarketplaceOfferV2> | null>;
  reset: () => void;
  status: PublishStatusV2;
  submitError: CommandError | null;
}

/**
 * One publish and, once live, one pause action for a single offer. The
 * publish idempotencyKey is minted on first submit and kept across every
 * retry until a request actually succeeds, only then does the next publish
 * attempt earn a fresh key. offer is only ever assigned from an awaited,
 * backend confirmed Result, there is no path that sets it before that,
 * publication is never optimistic.
 *
 * The pause idempotencyKey works differently on purpose: it is kept for
 * the lifetime of this hook instance rather than cleared on success, so a
 * second pause call against an already paused offer, whether a genuine
 * retry or a duplicate tap, replays the exact same stored result instead
 * of failing, which is what makes pause safe to repeat.
 */
export function usePublishOfferV2(storeId: string | null): UsePublishOfferV2Result {
  const api = useOptionalSellerApi();

  const [status, setStatus] = useState<PublishStatusV2>("idle");
  const [offer, setOffer] = useState<MarketplaceOfferV2 | null>(null);
  const [submitError, setSubmitError] = useState<CommandError | null>(null);
  const publishKeyRef = useRef<string | null>(null);
  const publishInFlightRef = useRef(false);

  const [pauseStatus, setPauseStatus] = useState<PauseStatusV2>("idle");
  const [pauseError, setPauseError] = useState<CommandError | null>(null);
  const pauseKeyRef = useRef<string | null>(null);
  const pauseInFlightRef = useRef(false);

  const publish = useCallback(
    async (input: PublishDraftInputV2) => {
      if (!api || !storeId || publishInFlightRef.current) {
        return null;
      }

      publishInFlightRef.current = true;
      if (!publishKeyRef.current) {
        publishKeyRef.current = generateOpaqueIdV2("publish");
      }
      setStatus("submitting");
      setSubmitError(null);

      const result = await api.approveAndPublishOfferV2({
        ...input,
        idempotencyKey: publishKeyRef.current,
        storeId,
      });

      publishInFlightRef.current = false;

      if (result.ok) {
        setOffer(result.value);
        setSubmitError(null);
        setStatus("published");
        // The action succeeded, a future publish is a new action and earns
        // its own idempotencyKey.
        publishKeyRef.current = null;
      } else {
        setSubmitError(result.error);
        setStatus("error");
        // publishKeyRef stays set on purpose, a retry of this same attempt
        // must reuse it rather than mint a new one.
      }

      return result;
    },
    [api, storeId]
  );

  const pause = useCallback(async () => {
    if (!api || !storeId || !offer || pauseInFlightRef.current) {
      return null;
    }

    pauseInFlightRef.current = true;
    if (!pauseKeyRef.current) {
      pauseKeyRef.current = generateOpaqueIdV2("pause");
    }
    setPauseStatus("in-flight");
    setPauseError(null);

    const result = await api.pauseOfferV2({
      expectedVersion: offer.version,
      idempotencyKey: pauseKeyRef.current,
      offerId: offer.id,
      storeId,
    });

    pauseInFlightRef.current = false;

    if (result.ok) {
      setOffer(result.value);
      setPauseError(null);
      setPauseStatus("paused");
    } else {
      setPauseError(result.error);
      setPauseStatus("error");
    }

    return result;
  }, [api, offer, storeId]);

  const reset = useCallback(() => {
    publishKeyRef.current = null;
    publishInFlightRef.current = false;
    pauseKeyRef.current = null;
    pauseInFlightRef.current = false;
    setStatus("idle");
    setOffer(null);
    setSubmitError(null);
    setPauseStatus("idle");
    setPauseError(null);
  }, []);

  return { offer, pause, pauseError, pauseStatus, publish, reset, status, submitError };
}
