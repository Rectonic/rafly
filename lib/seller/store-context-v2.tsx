import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, StoreMembershipV2, StoreRole } from "@/lib/contracts";

import { useOptionalSellerApi } from "./optional-context";

/**
 * Roles that may submit a physical count. Mirrors COUNT_ROLES in
 * lib/test-kit/in-memory-store-core.ts exactly, the backend is the source
 * of truth and the UI must never offer a control the backend would reject.
 */
const COUNT_CAPABLE_ROLES: ReadonlySet<StoreRole> = new Set([
  "staff",
  "manager",
  "owner",
]);

/**
 * Roles that may approve a stock adjustment, publish, or pause an offer.
 * Mirrors MANAGER_ROLES in lib/test-kit/in-memory-store-core.ts exactly.
 */
const APPROVE_CAPABLE_ROLES: ReadonlySet<StoreRole> = new Set(["manager", "owner"]);

export function canRecordInventoryCountV2(role: StoreRole | null): boolean {
  return role !== null && COUNT_CAPABLE_ROLES.has(role);
}

export function canApproveAndPublishV2(role: StoreRole | null): boolean {
  return role !== null && APPROVE_CAPABLE_ROLES.has(role);
}

/**
 * One value every v2 screen switches on instead of re deriving its own
 * gating logic:
 *
 * - unavailable: no ApiProvider is mounted, behave like plain v1
 * - loading: the membership fetch is in flight
 * - error: the membership fetch failed, retry is available
 * - no-membership: the caller is authenticated but belongs to no store,
 *   covers both a stranger and a cross-store user
 * - disabled: a membership exists but the store has not turned the Shop
 *   Seller beta flag on, fails closed rather than showing partial UI
 * - granted: membership, flag, and role are all known, the beta surface
 *   may render
 */
export type StoreAccessV2 =
  | "unavailable"
  | "loading"
  | "error"
  | "no-membership"
  | "disabled"
  | "granted";

export interface StoreMembershipStateV2 {
  access: StoreAccessV2;
  error: CommandError | null;
  memberships: StoreMembershipV2[];
  activeMembership: StoreMembershipV2 | null;
  role: StoreRole | null;
  canRecordCount: boolean;
  canApproveAndPublish: boolean;
  refresh: () => Promise<void>;
}

type FetchStatusV2 = "idle" | "loading" | "error" | "ready";

/**
 * The Shop Seller beta has one live pilot store per member for this slice,
 * so the first membership the backend returns is treated as the active
 * store. Nothing here picks between several memberships, a multi store
 * switcher is out of scope for sequences 1 to 4.
 */
export function useStoreMembershipV2(): StoreMembershipStateV2 {
  const api = useOptionalSellerApi();

  const [memberships, setMemberships] = useState<StoreMembershipV2[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatusV2>("idle");
  const [error, setError] = useState<CommandError | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api) {
      setMemberships([]);
      setError(null);
      setFetchStatus("idle");
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setFetchStatus("loading");
    setError(null);

    const result = await api.getMyStoreMembershipsV2();

    if (requestId !== requestSequenceRef.current) {
      // A newer refresh started after this one, its result is stale.
      return;
    }

    if (result.ok) {
      setMemberships(result.value);
      setError(null);
      setFetchStatus("ready");
    } else {
      setMemberships([]);
      setError(result.error);
      setFetchStatus("error");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeMembership = memberships[0] ?? null;
  const role = activeMembership?.role ?? null;

  const access: StoreAccessV2 = !api
    ? "unavailable"
    : fetchStatus === "error"
      ? "error"
      : fetchStatus === "idle" || fetchStatus === "loading"
        ? "loading"
        : !activeMembership
          ? "no-membership"
          : !activeMembership.storeFlags.shopSellerBetaEnabled
            ? "disabled"
            : "granted";

  const canRecordCount = access === "granted" && canRecordInventoryCountV2(role);
  const canApproveAndPublish = access === "granted" && canApproveAndPublishV2(role);

  return {
    access,
    activeMembership,
    canApproveAndPublish,
    canRecordCount,
    error,
    memberships,
    refresh,
    role,
  };
}
