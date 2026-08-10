import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useT } from "@/i18n";
import type {
  CommandError,
  CommandErrorCode,
  StoreExceptionV2,
} from "@/lib/contracts";
import { formatIsoTimestampV2 } from "@/lib/seller/format-v2";
import { generateOpaqueIdV2 } from "@/lib/seller/id-v2";
import { useOptionalSellerApi } from "@/lib/seller/optional-context";

interface ExceptionsPanelV2Props {
  canResolve: boolean;
  storeId: string;
  onResolved?: () => Promise<void> | void;
}

type FetchStatus = "loading" | "ready" | "error";

export function ExceptionsPanelV2({
  canResolve,
  storeId,
  onResolved,
}: ExceptionsPanelV2Props) {
  const api = useOptionalSellerApi();
  const t = useT();
  const [exceptions, setExceptions] = useState<StoreExceptionV2[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("loading");
  const [fetchError, setFetchError] = useState<CommandError | null>(null);
  const [activeExceptionId, setActiveExceptionId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteRequiredId, setNoteRequiredId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    exceptionId: string;
    error: CommandError;
  } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const inFlightRef = useRef<string | null>(null);
  const actionKeysRef = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setFetchError(null);
    setFetchStatus("loading");

    if (!api) {
      setExceptions([]);
      setFetchStatus("ready");
      return;
    }

    const result = await api.listStoreExceptionsV2(storeId);
    if (requestId !== requestSequenceRef.current) return;

    if (result.ok) {
      setExceptions(result.value);
      setFetchError(null);
      setFetchStatus("ready");
    } else {
      setExceptions([]);
      setFetchError(result.error);
      setFetchStatus("error");
    }
  }, [api, storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const errorCopy = (code: CommandErrorCode): string => {
    switch (code) {
      case "not_found":
        return t.sellerV2.exceptions.errorNotFound;
      case "forbidden":
        return t.sellerV2.exceptions.errorForbidden;
      case "validation_failed":
        return t.sellerV2.exceptions.errorValidationFailed;
      case "version_conflict":
        return t.sellerV2.exceptions.errorVersionConflict;
      case "invalid_state":
        return t.sellerV2.exceptions.errorInvalidState;
      case "idempotency_conflict":
        return t.sellerV2.exceptions.errorIdempotencyConflict;
      case "sold_out":
        return t.sellerV2.exceptions.errorSoldOut;
      case "offer_not_live":
        return t.sellerV2.exceptions.errorOfferNotLive;
      case "allocation_exceeded":
        return t.sellerV2.exceptions.errorAllocationExceeded;
      case "network_error":
        return t.sellerV2.exceptions.errorNetwork;
      case "unknown":
        return t.sellerV2.exceptions.errorUnknown;
    }
  };

  const openResolveForm = (exceptionId: string) => {
    if (!canResolve || inFlightRef.current !== null) return;
    setActiveExceptionId(exceptionId);
    setNoteRequiredId(null);
    setActionError(null);
  };

  const changeNote = (exceptionId: string, value: string) => {
    if (inFlightRef.current !== null) return;
    if (notes[exceptionId] !== value) {
      actionKeysRef.current.delete(exceptionId);
    }
    setNotes((current) => ({ ...current, [exceptionId]: value }));
    setNoteRequiredId(null);
    setActionError(null);
  };

  const resolveException = async (exceptionId: string) => {
    if (!api || !canResolve || inFlightRef.current !== null) return;

    const resolutionNote = (notes[exceptionId] ?? "").trim();
    if (resolutionNote.length === 0) {
      setNoteRequiredId(exceptionId);
      return;
    }

    let idempotencyKey = actionKeysRef.current.get(exceptionId);
    if (!idempotencyKey) {
      idempotencyKey = generateOpaqueIdV2("resolve-exception");
      actionKeysRef.current.set(exceptionId, idempotencyKey);
    }

    inFlightRef.current = exceptionId;
    setResolvingId(exceptionId);
    setNoteRequiredId(null);
    setActionError(null);

    const result = await api.resolveStoreExceptionV2({
      storeId,
      exceptionId,
      resolutionNote,
      idempotencyKey,
    });

    inFlightRef.current = null;
    setResolvingId(null);
    if (!result.ok) {
      setActionError({ exceptionId, error: result.error });
      return;
    }

    actionKeysRef.current.delete(exceptionId);
    setExceptions((current) =>
      current.map((exception) =>
        exception.id === exceptionId ? result.value : exception
      )
    );
    setActiveExceptionId(null);
    setNotes((current) => ({ ...current, [exceptionId]: "" }));
    if (onResolved) {
      await onResolved();
    }
  };

  return (
    <View style={styles.section} testID="exceptions-panel-v2">
      <Text style={styles.sectionTitle}>{t.sellerV2.exceptions.title}</Text>

      {fetchStatus === "loading" ? (
        <View style={styles.loadingRow} testID="exceptions-panel-v2-loading">
          <ActivityIndicator color="#D97706" />
          <Text style={styles.meta}>{t.sellerV2.exceptions.loading}</Text>
        </View>
      ) : null}

      {fetchStatus === "error" ? (
        <View style={styles.errorPanel} testID="exceptions-panel-v2-load-error">
          <Text style={styles.errorText}>
            {fetchError?.message || t.sellerV2.exceptions.loadError}
          </Text>
          <Pressable
            accessibilityLabel={t.sellerV2.exceptions.retry}
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={styles.retryButton}
            testID="exceptions-panel-v2-retry"
          >
            <Text style={styles.retryText}>{t.sellerV2.exceptions.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {fetchStatus === "ready" && exceptions.length === 0 ? (
        <Text style={styles.meta} testID="exceptions-panel-v2-empty">
          {t.sellerV2.exceptions.empty}
        </Text>
      ) : null}

      {fetchStatus === "ready"
        ? exceptions.map((exception) => {
            const isResolving = resolvingId === exception.id;
            const isResolved = exception.status === "resolved";
            return (
              <View
                key={exception.id}
                style={styles.card}
                testID={`exceptions-panel-v2-card-${exception.id}`}
              >
                <View style={styles.headerRow}>
                  <Text style={styles.cardTitle}>
                    {t.sellerV2.exceptions.kindLabel[exception.kind]}
                  </Text>
                  <Text style={isResolved ? styles.resolvedBadge : styles.openBadge}>
                    {isResolved
                      ? t.sellerV2.exceptions.resolvedStatus
                      : t.sellerV2.exceptions.openStatus}
                  </Text>
                </View>
                <Text style={styles.message}>{exception.message}</Text>
                <Text style={styles.meta}>
                  {t.sellerV2.exceptions.createdLabel(
                    formatIsoTimestampV2(exception.createdAt)
                  )}
                </Text>

                {isResolved ? (
                  <View
                    style={styles.successPanel}
                    testID={`exceptions-panel-v2-resolved-${exception.id}`}
                  >
                    <Text style={styles.successText}>
                      {t.sellerV2.exceptions.resolvedSuccess}
                    </Text>
                    {exception.resolutionNote ? (
                      <Text style={styles.meta}>
                        {t.sellerV2.exceptions.resolutionNoteLabel(
                          exception.resolutionNote
                        )}
                      </Text>
                    ) : null}
                    {exception.resolvedAt ? (
                      <Text style={styles.meta}>
                        {t.sellerV2.exceptions.resolvedAtLabel(
                          formatIsoTimestampV2(exception.resolvedAt)
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {!isResolved && canResolve ? (
                  <Pressable
                    accessibilityLabel={t.sellerV2.exceptions.resolveButton}
                    accessibilityRole="button"
                    disabled={inFlightRef.current !== null}
                    onPress={() => openResolveForm(exception.id)}
                    style={styles.resolveButton}
                    testID={`exceptions-panel-v2-resolve-${exception.id}`}
                  >
                    <Text style={styles.resolveButtonText}>
                      {t.sellerV2.exceptions.resolveButton}
                    </Text>
                  </Pressable>
                ) : null}

                {!isResolved && canResolve && activeExceptionId === exception.id ? (
                  <View style={styles.form}>
                    <TextInput
                      accessibilityLabel={t.sellerV2.exceptions.noteLabel}
                      editable={!isResolving}
                      multiline
                      onChangeText={(value) => changeNote(exception.id, value)}
                      placeholder={t.sellerV2.exceptions.noteLabel}
                      style={styles.input}
                      testID={`exceptions-panel-v2-note-${exception.id}`}
                      value={notes[exception.id] ?? ""}
                    />
                    {noteRequiredId === exception.id ? (
                      <Text
                        style={styles.errorText}
                        testID={`exceptions-panel-v2-note-required-${exception.id}`}
                      >
                        {t.sellerV2.exceptions.noteRequired}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityLabel={exception.kind === "stock_mismatch"
                        ? t.sellerV2.exceptions.submitButton
                        : t.sellerV2.exceptions.submitButtonDefault}
                      accessibilityRole="button"
                      disabled={isResolving}
                      onPress={() => void resolveException(exception.id)}
                      style={styles.submitButton}
                      testID={`exceptions-panel-v2-submit-${exception.id}`}
                    >
                      <Text style={styles.submitButtonText}>
                        {isResolving
                          ? t.sellerV2.exceptions.resolving
                          : exception.kind === "stock_mismatch"
                            ? t.sellerV2.exceptions.submitButton
                            : t.sellerV2.exceptions.submitButtonDefault}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {actionError?.exceptionId === exception.id ? (
                  <Text
                    style={styles.errorText}
                    testID={`exceptions-panel-v2-error-${exception.id}`}
                  >
                    {errorCopy(actionError.error.code)}
                  </Text>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F59E0B",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 14,
  },
  cardTitle: {
    color: "#111827",
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  errorText: { color: "#B91C1C" },
  form: { gap: 8 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  input: {
    borderColor: "#D1D5DB",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  message: { color: "#374151" },
  meta: { color: "#6B7280", fontSize: 13 },
  openBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    color: "#92400E",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  resolveButton: {
    alignSelf: "flex-start",
    borderColor: "#B45309",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resolveButtonText: { color: "#92400E", fontWeight: "700" },
  resolvedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: { color: "#B91C1C", fontWeight: "700" },
  section: { marginBottom: 16 },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#B45309",
    borderRadius: 10,
    paddingVertical: 10,
  },
  submitButtonText: { color: "#FFFFFF", fontWeight: "700" },
  successPanel: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  successText: { color: "#166534", fontWeight: "700" },
});
