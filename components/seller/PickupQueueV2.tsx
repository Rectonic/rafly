import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import type { CommandErrorCode, ReservationStatusV2, SellerPickupV2 } from "@/lib/contracts";
import { formatIsoTimestampV2 } from "@/lib/seller/format-v2";
import { useFulfillPickupV2, useSellerPickupsV2 } from "@/lib/seller/pickups-v2-store";
import { useReportStockMismatchV2 } from "@/lib/seller/stock-mismatch-v2";
import type { StoreMembershipStateV2 } from "@/lib/seller/store-context-v2";

import { AccessGateV2 } from "./AccessGateV2";

interface PickupQueueV2Props {
  access: StoreMembershipStateV2;
}

function newestFirst(left: SellerPickupV2, right: SellerPickupV2): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function parseObservedQuantity(raw: string): number | null {
  if (raw.trim().length === 0) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function openCountSession(storeProductId: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { router } = require("expo-router") as typeof import("expo-router");

  if (storeProductId) {
    router.push({
      params: { storeProductId },
      pathname: "/(seller-tabs)/count-session-v2",
    });
    return;
  }

  router.push("/(seller-tabs)/count-session-v2");
}

export function PickupQueueV2({ access }: PickupQueueV2Props) {
  const storeId = access.activeMembership?.storeId ?? null;
  const canHandlePickups = access.canApproveAndPublish;
  const queue = useSellerPickupsV2(storeId);
  const fulfillment = useFulfillPickupV2(storeId);
  const mismatch = useReportStockMismatchV2(storeId);
  const [activeSegment, setActiveSegment] = useState<"pending" | "terminal">("pending");
  const [pickupCode, setPickupCode] = useState("");
  const [mismatchOfferId, setMismatchOfferId] = useState<string | null>(null);
  const [observedQuantityText, setObservedQuantityText] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");
  const t = useT();

  const pending = useMemo(
    () => queue.pickups.filter((pickup) => pickup.status === "held").sort(newestFirst),
    [queue.pickups]
  );
  const terminal = useMemo(
    () => queue.pickups.filter((pickup) => pickup.status !== "held").sort(newestFirst),
    [queue.pickups]
  );
  const visiblePickups = activeSegment === "pending" ? pending : terminal;

  const handleFulfill = async () => {
    if (!canHandlePickups || fulfillment.status === "in-flight") return;
    const result = await fulfillment.fulfill(pickupCode);
    if (!result) return;

    await queue.refresh();
  };

  const handlePickupCodeChange = (value: string) => {
    if (fulfillment.status === "in-flight") return;
    if (value !== pickupCode) fulfillment.reset();
    setPickupCode(value);
  };

  const handleMismatch = async () => {
    const observedQuantity = parseObservedQuantity(observedQuantityText);
    const reason = mismatchReason.trim();
    if (
      !canHandlePickups ||
      !mismatchOfferId ||
      observedQuantity === null ||
      reason.length === 0 ||
      mismatch.status === "in-flight"
    ) {
      return;
    }

    const response = await mismatch.report({
      observedQuantity,
      offerId: mismatchOfferId,
      reason,
    });
    if (response?.ok) {
      await queue.refresh();
    }
  };

  const fulfillmentErrorCopy = (code: CommandErrorCode) => {
    switch (code) {
      case "not_found":
        return t.sellerV2.pickups.errorNotFound;
      case "invalid_state":
      case "version_conflict":
        return t.sellerV2.pickups.errorInvalidState;
      case "forbidden":
        return t.sellerV2.pickups.errorForbidden;
      case "network_error":
        return t.sellerV2.pickups.errorNetwork;
      default:
        return t.sellerV2.pickups.errorFallback;
    }
  };

  const queueErrorCopy = () => {
    switch (queue.error?.code) {
      case "forbidden":
        return t.sellerV2.pickups.loadForbidden;
      case "not_found":
        return t.sellerV2.pickups.loadNotFound;
      case "network_error":
        return t.sellerV2.pickups.loadError;
      default:
        return t.sellerV2.pickups.loadErrorFallback;
    }
  };

  return (
    <AccessGateV2 access={access} screenTestId="pickups-v2">
      <ScreenScrollView contentContainerStyle={styles.container} testID="pickups-v2-screen">
        <Text style={styles.title}>{t.sellerV2.pickups.title}</Text>

        {canHandlePickups ? (
          <View style={styles.fulfillmentPanel}>
            <Text style={styles.sectionTitle}>{t.sellerV2.pickups.fulfillTitle}</Text>
            <Text style={styles.meta}>{t.sellerV2.pickups.codePrivacyHint}</Text>
            <TextInput
              accessibilityLabel={t.sellerV2.pickups.codePlaceholder}
              autoCapitalize="characters"
              editable={fulfillment.status !== "in-flight"}
              onChangeText={handlePickupCodeChange}
              placeholder={t.sellerV2.pickups.codePlaceholder}
              secureTextEntry
              style={styles.input}
              testID="pickups-v2-code-input"
              value={pickupCode}
            />
            <Pressable
              accessibilityLabel={t.sellerV2.pickups.fulfillButton}
              accessibilityRole="button"
              disabled={pickupCode.length === 0 || fulfillment.status === "in-flight"}
              onPress={() => void handleFulfill()}
              style={[
                styles.primaryButton,
                pickupCode.length === 0 || fulfillment.status === "in-flight"
                  ? styles.disabledButton
                  : null,
              ]}
              testID="pickups-v2-fulfill-button"
            >
              <Text style={styles.primaryButtonText}>
                {fulfillment.status === "in-flight"
                  ? t.sellerV2.pickups.fulfilling
                  : t.sellerV2.pickups.fulfillButton}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.meta} testID="pickups-v2-role-guidance">
            {t.sellerV2.pickups.managerOnly}
          </Text>
        )}

        {fulfillment.status === "fulfilled" ? (
          <Text style={styles.success} testID="pickups-v2-success-state">
            {t.sellerV2.pickups.fulfilledSuccess}
          </Text>
        ) : null}
        {fulfillment.status === "error" && fulfillment.error ? (
          <Text
            style={styles.errorText}
            testID={`pickups-v2-${
              fulfillment.error.code === "not_found"
                ? "not-found"
                : fulfillment.error.code === "invalid_state" ||
                    fulfillment.error.code === "version_conflict"
                  ? "invalid-state"
                  : "action"
            }-error`}
          >
            {fulfillmentErrorCopy(fulfillment.error.code)}
          </Text>
        ) : null}

        {canHandlePickups && mismatchOfferId ? (
          <View style={styles.mismatchPanel} testID="pickups-v2-mismatch-form">
            <Text style={styles.sectionTitle}>{t.sellerV2.pickups.mismatchTitle}</Text>
            <Text style={styles.meta}>{t.sellerV2.pickups.mismatchSafetyHint}</Text>
            <TextInput
              accessibilityLabel={t.sellerV2.pickups.observedQuantityLabel}
              keyboardType="number-pad"
              onChangeText={setObservedQuantityText}
              placeholder={t.sellerV2.pickups.observedQuantityLabel}
              style={styles.input}
              testID="pickups-v2-mismatch-observed-input"
              value={observedQuantityText}
            />
            <TextInput
              accessibilityLabel={t.sellerV2.pickups.mismatchReasonLabel}
              multiline
              onChangeText={setMismatchReason}
              placeholder={t.sellerV2.pickups.mismatchReasonLabel}
              style={styles.input}
              testID="pickups-v2-mismatch-reason-input"
              value={mismatchReason}
            />
            {mismatchReason.trim().length === 0 ? (
              <Text style={styles.errorText} testID="pickups-v2-mismatch-reason-required">
                {t.sellerV2.pickups.mismatchReasonRequired}
              </Text>
            ) : null}
            <Pressable
              accessibilityLabel={t.sellerV2.pickups.mismatchSubmitButton}
              accessibilityRole="button"
              disabled={
                parseObservedQuantity(observedQuantityText) === null ||
                mismatchReason.trim().length === 0 ||
                mismatch.status === "in-flight"
              }
              onPress={() => void handleMismatch()}
              style={styles.dangerButton}
              testID="pickups-v2-mismatch-submit-button"
            >
              <Text style={styles.dangerButtonText}>
                {mismatch.status === "in-flight"
                  ? t.sellerV2.pickups.mismatchSubmitting
                  : t.sellerV2.pickups.mismatchSubmitButton}
              </Text>
            </Pressable>
            {mismatch.status === "in-flight" ? (
              <Text style={styles.meta} testID="pickups-v2-mismatch-submitting">
                {t.sellerV2.pickups.mismatchAwaitingConfirmation}
              </Text>
            ) : null}
            {mismatch.status === "error" && mismatch.error ? (
              <Text
                style={styles.errorText}
                testID={`pickups-v2-mismatch-${
                  mismatch.error.code === "network_error"
                    ? "network"
                    : mismatch.error.code === "invalid_state" ||
                        mismatch.error.code === "version_conflict"
                      ? "invalid-state"
                      : "action"
                }-error`}
              >
                {mismatch.error.code === "network_error"
                  ? t.sellerV2.pickups.mismatchNetworkError
                  : mismatch.error.code === "invalid_state" ||
                      mismatch.error.code === "version_conflict"
                    ? t.sellerV2.pickups.mismatchInvalidStateError
                    : mismatch.error.code === "forbidden"
                      ? t.sellerV2.pickups.mismatchForbiddenError
                      : mismatch.error.code === "not_found"
                        ? t.sellerV2.pickups.mismatchNotFoundError
                        : t.sellerV2.pickups.mismatchErrorFallback}
              </Text>
            ) : null}
            {mismatch.status === "confirmed" && mismatch.result ? (
              <View style={styles.successPanel} testID="pickups-v2-mismatch-recount-guidance">
                <Text style={styles.success} testID="pickups-v2-mismatch-success">
                  {t.sellerV2.pickups.mismatchConfirmed}
                </Text>
                <Text style={styles.meta}>{t.sellerV2.pickups.recountGuidance}</Text>
                <Pressable
                  accessibilityLabel={t.sellerV2.pickups.recountButton}
                  accessibilityRole="button"
                  onPress={() =>
                    openCountSession(
                      mismatch.result?.exception.relatedStoreProductId ?? null
                    )
                  }
                  style={styles.retryButton}
                  testID="pickups-v2-mismatch-recount-button"
                >
                  <Text style={styles.retryText}>{t.sellerV2.pickups.recountButton}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.segmentRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeSegment === "pending" }}
            onPress={() => setActiveSegment("pending")}
            style={[styles.segment, activeSegment === "pending" ? styles.segmentActive : null]}
            testID="pickups-v2-pending-segment"
          >
            <Text style={styles.segmentText}>{t.sellerV2.pickups.pendingSegment(pending.length)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeSegment === "terminal" }}
            onPress={() => setActiveSegment("terminal")}
            style={[styles.segment, activeSegment === "terminal" ? styles.segmentActive : null]}
            testID="pickups-v2-terminal-segment"
          >
            <Text style={styles.segmentText}>{t.sellerV2.pickups.terminalSegment(terminal.length)}</Text>
          </Pressable>
        </View>

        {queue.status === "idle" || queue.status === "loading" ? (
          <View style={styles.centered} testID="pickups-v2-loading-state">
            <ActivityIndicator color="#16C79A" />
            <Text style={styles.meta}>{t.sellerV2.pickups.loading}</Text>
          </View>
        ) : null}

        {queue.status === "error" ? (
          <View style={styles.errorPanel} testID="pickups-v2-load-error">
            <Text style={styles.errorText}>{queueErrorCopy()}</Text>
            <Pressable
              accessibilityLabel={t.sellerV2.pickups.retry}
              accessibilityRole="button"
              onPress={() => void queue.refresh()}
              style={styles.retryButton}
              testID="pickups-v2-retry-button"
            >
              <Text style={styles.retryText}>{t.sellerV2.pickups.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {queue.status === "ready" && visiblePickups.length === 0 ? (
          <Text style={styles.meta} testID="pickups-v2-empty-state">
            {activeSegment === "pending"
              ? t.sellerV2.pickups.emptyPending
              : t.sellerV2.pickups.emptyTerminal}
          </Text>
        ) : null}

        {queue.status === "ready"
          ? visiblePickups.map((pickup) => (
              <View
                key={pickup.reservationId}
                style={styles.pickupCard}
                testID={`pickups-v2-row-${pickup.reservationId}`}
              >
                <Text style={styles.cardTitle}>{pickup.offerTitle}</Text>
                <Text
                  style={styles.statusText}
                  testID={`pickups-v2-status-${pickup.reservationId}`}
                >
                  {t.sellerV2.pickups.statusLabel[pickup.status as ReservationStatusV2]}
                </Text>
                <Text style={styles.meta}>
                  {t.sellerV2.pickups.codeHint(pickup.pickupCodeHint)}
                </Text>
                <Text style={styles.meta}>
                  {t.sellerV2.pickups.pickupWindow(
                    formatIsoTimestampV2(pickup.pickupStart),
                    formatIsoTimestampV2(pickup.pickupEnd)
                  )}
                </Text>
                {canHandlePickups && pickup.status === "held" ? (
                  <Pressable
                    accessibilityLabel={t.sellerV2.pickups.reportMismatchButton}
                    accessibilityRole="button"
                    disabled={mismatch.status === "in-flight"}
                    onPress={() => {
                      if (
                        !canHandlePickups ||
                        mismatch.status === "in-flight"
                      ) {
                        return;
                      }
                      mismatch.reset();
                      setMismatchOfferId(pickup.offerId);
                      setObservedQuantityText("");
                      setMismatchReason("");
                    }}
                    style={styles.mismatchButton}
                    testID={`pickups-v2-report-mismatch-${pickup.reservationId}`}
                  >
                    <Text style={styles.mismatchButtonText}>
                      {t.sellerV2.pickups.reportMismatchButton}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          : null}
      </ScreenScrollView>
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: "#111827", fontSize: 16, fontWeight: "700" },
  centered: { alignItems: "center", gap: 8, paddingVertical: 24 },
  container: { backgroundColor: "#F8F9FA", minHeight: "100%", padding: 16 },
  disabledButton: { opacity: 0.5 },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#B91C1C",
    borderRadius: 10,
    paddingVertical: 12,
  },
  dangerButtonText: { color: "#FFFFFF", fontWeight: "700" },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  errorText: { color: "#B91C1C", marginBottom: 12 },
  fulfillmentPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  input: {
    borderColor: "#D1D5DB",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  meta: { color: "#6B7280", fontSize: 13 },
  mismatchButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mismatchButtonText: { color: "#B91C1C", fontWeight: "700" },
  mismatchPanel: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 14,
  },
  pickupCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginBottom: 10,
    padding: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 10,
    paddingVertical: 12,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: { color: "#B91C1C", fontWeight: "700" },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  segment: {
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  segmentActive: { backgroundColor: "#A7F3D0" },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 14, marginTop: 4 },
  segmentText: { color: "#065F46", fontWeight: "700" },
  statusText: { color: "#047857", fontWeight: "700" },
  success: { color: "#047857", fontWeight: "700", marginBottom: 12 },
  successPanel: { gap: 8, marginTop: 4 },
  title: { color: "#111827", fontSize: 24, fontWeight: "700", marginBottom: 12 },
});
