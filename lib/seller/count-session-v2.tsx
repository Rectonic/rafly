import { useCallback, useRef, useState } from "react";

import type {
  CommandError,
  Result,
  StockAdjustmentProposalV2,
} from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export type CountSessionStatusV2 = "idle" | "submitting" | "submitted" | "error";

/**
 * "idle", "in-flight", "stale", and "error" are UI only states, the other
 * four are StockAdjustmentProposalV2["status"] itself, reused rather than
 * re-declared so a proposal status this type cannot represent is a type
 * error here rather than a silently mishandled case at render time.
 */
export type ProposalDecisionStatusV2 =
  | "idle"
  | "in-flight"
  | "stale"
  | "error"
  | StockAdjustmentProposalV2["status"];

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

/** True when two line sets cover the exact same products and quantities, order not significant. */
function sameLineSet(a: CountLineInputV2[], b: CountLineInputV2[]): boolean {
  if (a.length !== b.length) return false;
  const normalize = (lines: CountLineInputV2[]) =>
    [...lines]
      .map((line) => `${line.storeProductId}:${line.observedQuantity}`)
      .sort()
      .join("|");
  return normalize(a) === normalize(b);
}

/**
 * One physical count session. countSessionId is minted once, on the first
 * render, and reused for every retry of submit as long as the retry
 * resubmits the exact same lines, matching the backend rule that a
 * repeated countSessionId replays the same result rather than creating a
 * second observation. A retry after an error that instead submits a
 * different set of products or quantities is a materially different
 * count, it earns a fresh countSessionId rather than risking a replay or
 * an idempotency_conflict against whatever the first attempt's payload
 * happened to be.
 *
 * Proposal decisions get their own idempotencyKey each, keyed by proposal
 * and decision together so approving and rejecting the same proposal never
 * share one key, generated the first time that exact decision is made and
 * reused only if that same decision needs to retry.
 *
 * Version tracking for a decided proposal starts from what submit
 * returned and only ever advances from a value the backend confirmed,
 * either the version on a successful decision or the currentVersion the
 * backend reports inside a version_conflict error. Nothing here guesses a
 * next version.
 */
export function useCountSessionV2(storeId: string | null): UseCountSessionV2Result {
  const api = useOptionalSellerApi();

  const [countSessionId, setCountSessionId] = useState(() =>
    generateOpaqueIdV2("count-session")
  );
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
  const lastLinesRef = useRef<CountLineInputV2[]>([]);
  const statusRef = useRef<CountSessionStatusV2>(status);
  statusRef.current = status;

  const submit = useCallback(
    async (lines: CountLineInputV2[]) => {
      if (!api || !storeId || lines.length === 0 || submitInFlightRef.current) {
        return null;
      }

      let activeSessionId = countSessionId;
      if (statusRef.current === "error" && !sameLineSet(lastLinesRef.current, lines)) {
        activeSessionId = generateOpaqueIdV2("count-session");
        setCountSessionId(activeSessionId);
      }
      lastLinesRef.current = lines;

      submitInFlightRef.current = true;
      setStatus("submitting");
      setSubmitError(null);

      const result = await api.recordInventoryCountV2({
        countSessionId: activeSessionId,
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

      const decisionKey = `${proposalId}:${decision}`;
      let idempotencyKey = decisionKeysRef.current.get(decisionKey);
      if (!idempotencyKey) {
        idempotencyKey = generateOpaqueIdV2("adjustment-decision");
        decisionKeysRef.current.set(decisionKey, idempotencyKey);
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
          [proposalId]: result.value.status,
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
