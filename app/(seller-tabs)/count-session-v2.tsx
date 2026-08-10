import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { useT } from "@/i18n";
import type { StockAdjustmentProposalV2 } from "@/lib/contracts";
import {
  useCountSessionV2,
  type ProposalDecisionStatusV2,
} from "@/lib/seller/count-session-v2";
import { useStoreInventoryV2 } from "@/lib/seller/inventory-v2-store";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

function parseObservedQuantity(raw: string): number | null {
  if (raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * StockAdjustmentProposalV2.status carries four distinct values, each one
 * gets its own copy here rather than a two way applied-or-rejected guess,
 * an "approved" proposal (decided, not yet reflected in stock) must never
 * read as "Rejected" just because it is not literally "applied" yet.
 */
function decisionLabel(
  t: ReturnType<typeof useT>,
  status: StockAdjustmentProposalV2["status"]
): string {
  switch (status) {
    case "approved":
      return t.sellerV2.count.approvedLabel;
    case "applied":
      return t.sellerV2.count.appliedLabel;
    case "rejected":
      return t.sellerV2.count.rejectedLabel;
    case "pending":
    default:
      return t.sellerV2.count.pendingApproval;
  }
}

export default function CountSessionV2Screen() {
  const access = useStoreMembershipV2();
  const storeId = access.activeMembership?.storeId ?? null;
  const inventory = useStoreInventoryV2(storeId);
  const session = useCountSessionV2(storeId);
  const params = useLocalSearchParams<{ storeProductId?: string }>();
  const t = useT();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(params.storeProductId ? [params.storeProductId] : [])
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const isLocked = session.status === "submitting" || session.status === "submitted";

  const proposalByProduct = useMemo(() => {
    const map = new Map<string, StockAdjustmentProposalV2>();
    for (const proposal of session.proposals) {
      map.set(proposal.storeProductId, proposal);
    }
    return map;
  }, [session.proposals]);

  const toggleSelected = (storeProductId: string) => {
    if (isLocked) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(storeProductId)) {
        next.delete(storeProductId);
      } else {
        next.add(storeProductId);
      }
      return next;
    });
  };

  const submit = () => {
    const lines = [...selectedIds]
      .map((storeProductId) => ({
        observedQuantity: parseObservedQuantity(drafts[storeProductId] ?? ""),
        storeProductId,
      }))
      .filter(
        (line): line is { observedQuantity: number; storeProductId: string } =>
          line.observedQuantity !== null
      );
    if (lines.length === 0) return;
    void session.submit(lines);
  };

  const canSubmit =
    !isLocked &&
    [...selectedIds].every((id) => parseObservedQuantity(drafts[id] ?? "") !== null) &&
    selectedIds.size > 0;

  return (
    <AccessGateV2 access={access} screenTestId="count-session-v2">
      {!access.canRecordCount ? (
        <View style={styles.panel} testID="count-session-v2-forbidden-state">
          <Text style={styles.forbiddenTitle}>{t.sellerV2.count.forbiddenTitle}</Text>
          <Text style={styles.meta}>{t.sellerV2.count.forbiddenMessage}</Text>
        </View>
      ) : (
        <ScreenScrollView
          contentContainerStyle={styles.container}
          testID="count-session-v2-screen"
        >
          <Text style={styles.title}>{t.sellerV2.count.title}</Text>

          {inventory.status === "loading" || inventory.status === "idle" ? (
            <ActivityIndicator color="#16C79A" />
          ) : null}

          {inventory.status === "ready" ? (
            <>
              <Text style={styles.sectionLabel}>{t.sellerV2.count.selectProductsTitle}</Text>
              {inventory.items.map((item) => {
                const selected = selectedIds.has(item.storeProductId);
                const proposal = proposalByProduct.get(item.storeProductId);
                const wasSubmittedLine =
                  isLocked && (selected || proposal !== undefined);

                return (
                  <View
                    key={item.storeProductId}
                    style={styles.row}
                    testID={`count-session-v2-product-${item.storeProductId}`}
                  >
                    <View style={styles.rowHeader}>
                      <Text style={styles.productName}>{item.productName}</Text>
                      {!isLocked ? (
                        <Pressable
                          accessibilityLabel={item.productName}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          onPress={() => toggleSelected(item.storeProductId)}
                          style={[styles.selectChip, selected ? styles.selectChipActive : null]}
                          testID={`count-session-v2-select-${item.storeProductId}`}
                        >
                          <Text
                            style={[
                              styles.selectChipText,
                              selected ? styles.selectChipTextActive : null,
                            ]}
                          >
                            {selected
                              ? t.sellerV2.count.selectedLabel
                              : t.sellerV2.count.selectLabel}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {selected && !isLocked ? (
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={(value) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.storeProductId]: value,
                          }))
                        }
                        placeholder={t.sellerV2.count.observedQuantityLabel}
                        style={styles.input}
                        testID={`count-session-v2-quantity-${item.storeProductId}`}
                        value={drafts[item.storeProductId] ?? ""}
                      />
                    ) : null}

                    {wasSubmittedLine ? (
                      <Text
                        style={styles.meta}
                        testID={`count-session-v2-submitted-line-${item.storeProductId}`}
                      >
                        {t.sellerV2.count.observedQuantityLabel}: {drafts[item.storeProductId]}
                      </Text>
                    ) : null}

                    {proposal ? (
                      <View
                        style={styles.proposalCard}
                        testID={`count-session-v2-proposal-line-${item.storeProductId}`}
                      >
                        <Text style={styles.meta}>
                          {t.sellerV2.count.proposalLine(
                            proposal.currentQuantity,
                            proposal.proposedQuantity
                          )}
                        </Text>

                        {proposal.status === "pending" ? (
                          access.canApproveAndPublish ? (
                            <DecisionButtons
                              onApprove={() => void session.decide(proposal.id, "approve")}
                              onReject={() => void session.decide(proposal.id, "reject")}
                              proposal={proposal}
                              status={session.decisionStatusFor(proposal.id)}
                              t={t}
                            />
                          ) : (
                            <Text
                              style={styles.pending}
                              testID={`count-session-v2-pending-approval-${item.storeProductId}`}
                            >
                              {t.sellerV2.count.pendingApproval}
                            </Text>
                          )
                        ) : (
                          <Text
                            style={styles.decided}
                            testID={`count-session-v2-decided-${item.storeProductId}`}
                          >
                            {decisionLabel(t, proposal.status)}
                          </Text>
                        )}

                        {session.decisionStatusFor(proposal.id) === "stale" ? (
                          <View testID={`count-session-v2-stale-${item.storeProductId}`}>
                            <Text style={styles.staleTitle}>{t.sellerV2.count.staleTitle}</Text>
                            <Text style={styles.meta}>{t.sellerV2.count.staleMessage}</Text>
                          </View>
                        ) : null}
                        {session.decisionStatusFor(proposal.id) === "error" ? (
                          session.decisionErrorFor(proposal.id)?.code === "invalid_state" ? (
                            <Text
                              style={styles.staleTitle}
                              testID={`count-session-v2-already-decided-${item.storeProductId}`}
                            >
                              {t.sellerV2.count.alreadyDecidedTitle}
                            </Text>
                          ) : (
                            <Text
                              style={styles.errorText}
                              testID={`count-session-v2-decision-error-${item.storeProductId}`}
                            >
                              {session.decisionErrorFor(proposal.id)?.message ??
                                t.sellerV2.count.decisionErrorFallback}
                            </Text>
                          )
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}

          {!isLocked ? (
            <Pressable
              accessibilityLabel={t.sellerV2.count.submitButton}
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={submit}
              style={[styles.submitButton, !canSubmit ? styles.disabledButton : null]}
              testID="count-session-v2-submit-button"
            >
              <Text style={styles.submitButtonText}>
                {session.status === "submitting"
                  ? t.sellerV2.count.submitting
                  : t.sellerV2.count.submitButton}
              </Text>
            </Pressable>
          ) : null}

          {session.status === "error" ? (
            <View style={styles.errorPanel} testID="count-session-v2-submit-error">
              <Text style={styles.errorText}>
                {session.submitError?.message ?? t.sellerV2.count.submitErrorFallback}
              </Text>
              <Pressable
                accessibilityLabel={t.sellerV2.count.retry}
                accessibilityRole="button"
                onPress={submit}
                style={styles.errorRetryButton}
                testID="count-session-v2-submit-retry-button"
              >
                <Text style={styles.errorRetryText}>{t.sellerV2.count.retry}</Text>
              </Pressable>
            </View>
          ) : null}

          {session.status === "submitted" && session.proposals.length === 0 ? (
            <Text style={styles.meta} testID="count-session-v2-no-changes">
              {t.sellerV2.count.noChangesTitle}
            </Text>
          ) : null}
        </ScreenScrollView>
      )}
    </AccessGateV2>
  );
}

function DecisionButtons({
  onApprove,
  onReject,
  proposal,
  status,
  t,
}: {
  onApprove: () => void;
  onReject: () => void;
  proposal: StockAdjustmentProposalV2;
  status: ProposalDecisionStatusV2;
  t: ReturnType<typeof useT>;
}) {
  const busy = status === "in-flight";
  return (
    <View style={styles.decisionRow}>
      <Pressable
        accessibilityLabel={t.sellerV2.count.approveButton}
        accessibilityRole="button"
        disabled={busy}
        onPress={onApprove}
        style={styles.approveButton}
        testID={`count-session-v2-approve-${proposal.storeProductId}`}
      >
        <Text style={styles.approveButtonText}>
          {busy ? t.sellerV2.count.deciding : t.sellerV2.count.approveButton}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t.sellerV2.count.rejectButton}
        accessibilityRole="button"
        disabled={busy}
        onPress={onReject}
        style={styles.rejectButton}
        testID={`count-session-v2-reject-${proposal.storeProductId}`}
      >
        <Text style={styles.rejectButtonText}>
          {busy ? t.sellerV2.count.deciding : t.sellerV2.count.rejectButton}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  approveButton: {
    backgroundColor: "#16C79A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  decided: {
    color: "#047857",
    fontWeight: "700",
  },
  decisionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorRetryText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
  },
  forbiddenTitle: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  panel: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  pending: {
    color: "#92400E",
    fontWeight: "600",
  },
  productName: {
    color: "#111827",
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  proposalCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    gap: 4,
    marginTop: 8,
    padding: 10,
  },
  rejectButton: {
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  row: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectChip: {
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectChipActive: {
    backgroundColor: "#16C79A",
    borderColor: "#16C79A",
  },
  selectChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  selectChipTextActive: {
    color: "#FFFFFF",
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  staleTitle: {
    color: "#B45309",
    fontWeight: "700",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
});
