import { useCallback, useRef, useState } from "react";

import type {
  CommandError,
  Result,
  StockAdjustmentProposalV2,
} from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export type CountSessionStatusV2 = "idle" | "submitting" | "submitted" | "error";

export type ProposalDecisionStatusV2 =
  | "idle"
  | "in-flight"
  | "applied"
  | "rejected"
  | "stale"
  | "error";

export interface CountLineInputV2 {
  observedQuantity: number;
  storeProductId: string;
}

export interface UseCountSessionV2Result {
  countSessionId: string;
  decide: (
    proposalId: string,
    decision: "approve" | "reject"
  ) => Promise<Result<StockAdjustmentProposalV2> | null>;
  decisionErrorFor: (proposalId: string) => CommandError | null;
  decisionStatusFor: (proposalId: string) => ProposalDecisionStatusV2;
  proposals: StockAdjustmentProposalV2[];
  status: CountSessionStatusV2;
  submit: (lines: CountLineInputV2[]) => Promise<Result<StockAdjustmentProposalV2[]> | null>;
  submitError: CommandError | null;
}

/**
 * One physical count session. countSessionId is minted once, on the first
 * render, and reused for every retry of submit, exactly matching the
 * backend rule that a repeated countSessionId replays the same result
 * rather than creating a second observation. Proposal decisions get their
 * own idempotencyKey each, generated the first time a given proposal is
 * decided and reused if that same decision needs to retry.
 *
 * Version tracking for a decided proposal starts from what submit
 * returned and only ever advances from a value the backend confirmed,
 * either the version on a successful decision or the currentVersion the
 * backend reports inside a version_conflict error. Nothing here guesses a
 * next version.
 */
export function useCountSessionV2(storeId: string | null): UseCountSessionV2Result {
  const api = useOptionalSellerApi();

  const [countSessionId] = useState(() => generateOpaqueIdV2("count-session"));
  const [status, setStatus] = useState<CountSessionStatusV2>("idle");
  const [proposals, setProposals] = useState<StockAdjustmentProposalV2[]>([]);
  const [submitError, setSubmitError] = useState<CommandError | null>(null);

  const [decisionStatusMap, setDecisionStatusMap] = useState<
    Record<string, ProposalDecisionStatusV2>
  >({});
  const [decisionErrorMap, setDecisionErrorMap] = useState<
    Record<string, CommandError | null>
  >({});

  const versionsRef = useRef<Record<string, number>>({});
  const decisionKeysRef = useRef<Map<string, string>>(new Map());
  const submitInFlightRef = useRef(false);
  const decisionInFlightRef = useRef<Set<string>>(new Set());

  const submit = useCallback(
    async (lines: CountLineInputV2[]) => {
      if (!api || !storeId || lines.length === 0 || submitInFlightRef.current) {
        return null;
      }

      submitInFlightRef.current = true;
      setStatus("submitting");
      setSubmitError(null);

      const result = await api.recordInventoryCountV2({
        countSessionId,
        lines,
        storeId,
      });

      submitInFlightRef.current = false;

      if (result.ok) {
        for (const proposal of result.value) {
          versionsRef.current[proposal.id] = proposal.version;
        }
        setProposals(result.value);
        setSubmitError(null);
        setStatus("submitted");
      } else {
        setSubmitError(result.error);
        setStatus("error");
      }

      return result;
    },
    [api, countSessionId, storeId]
  );

  const decide = useCallback(
    async (proposalId: string, decision: "approve" | "reject") => {
      if (!api || !storeId || decisionInFlightRef.current.has(proposalId)) {
        return null;
      }

      const expectedVersion = versionsRef.current[proposalId];
      if (expectedVersion === undefined) {
        return null;
      }

      let idempotencyKey = decisionKeysRef.current.get(proposalId);
      if (!idempotencyKey) {
        idempotencyKey = generateOpaqueIdV2("adjustment-decision");
        decisionKeysRef.current.set(proposalId, idempotencyKey);
      }

      decisionInFlightRef.current.add(proposalId);
      setDecisionStatusMap((current) => ({ ...current, [proposalId]: "in-flight" }));
      setDecisionErrorMap((current) => ({ ...current, [proposalId]: null }));

      const result = await api.approveStockAdjustmentV2({
        decision,
        expectedVersion,
        idempotencyKey,
        proposalId,
        storeId,
      });

      decisionInFlightRef.current.delete(proposalId);

      if (result.ok) {
        versionsRef.current[proposalId] = result.value.version;
        setProposals((current) =>
          current.map((proposal) => (proposal.id === proposalId ? result.value : proposal))
        );
        setDecisionStatusMap((current) => ({
          ...current,
          [proposalId]: result.value.status === "applied" ? "applied" : "rejected",
        }));
        setDecisionErrorMap((current) => ({ ...current, [proposalId]: null }));
      } else if (result.error.code === "version_conflict") {
        const currentVersion = result.error.details?.currentVersion;
        if (typeof currentVersion === "number") {
          versionsRef.current[proposalId] = currentVersion;
        }
        setDecisionStatusMap((current) => ({ ...current, [proposalId]: "stale" }));
        setDecisionErrorMap((current) => ({ ...current, [proposalId]: result.error }));
      } else {
        setDecisionStatusMap((current) => ({ ...current, [proposalId]: "error" }));
        setDecisionErrorMap((current) => ({ ...current, [proposalId]: result.error }));
      }

      return result;
    },
    [api, storeId]
  );

  const decisionStatusFor = useCallback(
    (proposalId: string) => decisionStatusMap[proposalId] ?? "idle",
    [decisionStatusMap]
  );
  const decisionErrorFor = useCallback(
    (proposalId: string) => decisionErrorMap[proposalId] ?? null,
    [decisionErrorMap]
  );

  return {
    countSessionId,
    decide,
    decisionErrorFor,
    decisionStatusFor,
    proposals,
    status,
    submit,
    submitError,
  };
}
