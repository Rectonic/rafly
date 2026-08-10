import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { ImportRecordCardV2 } from "@/components/seller/ImportRecordCardV2";
import { useT } from "@/i18n";
import type { CommandError, ImportBatchV2, StagedSourceRecordV2 } from "@/lib/contracts";
import {
  parseSellerCsv,
  type CsvImportRecord,
  type CsvParseError,
} from "@/lib/seller/csv-parse";
import { generateOpaqueIdV2 } from "@/lib/seller/id-v2";
import { useOptionalSellerApi } from "@/lib/seller/optional-context";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

export default function ImportV2Screen() {
  const access = useStoreMembershipV2();
  const api = useOptionalSellerApi();
  const storeId = access.activeMembership?.storeId ?? null;
  const t = useT();
  const [filename, setFilename] = useState("");
  const [source, setSource] = useState("");
  const [records, setRecords] = useState<CsvImportRecord[] | null>(null);
  const [parseError, setParseError] = useState<CsvParseError | null>(null);
  const [batches, setBatches] = useState<ImportBatchV2[]>([]);
  const [batchesStatus, setBatchesStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [batchesError, setBatchesError] = useState<CommandError | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "in-flight" | "error" | "success">("idle");
  const [uploadError, setUploadError] = useState<CommandError | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [stagedRecords, setStagedRecords] = useState<StagedSourceRecordV2[]>([]);
  const [recordsStatus, setRecordsStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [recordsError, setRecordsError] = useState<CommandError | null>(null);
  const [candidateSelections, setCandidateSelections] = useState<Record<string, string>>({});
  const [decisionStatuses, setDecisionStatuses] = useState<Record<string, "in-flight" | "error" | "success">>({});
  const [decisionErrors, setDecisionErrors] = useState<Record<string, CommandError>>({});
  const uploadInFlightRef = useRef(false);
  const uploadKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const decisionsInFlightRef = useRef(new Set<string>());
  const decisionKeysRef = useRef(new Map<string, string>());
  const batchesRequestSequenceRef = useRef(0);
  const recordsRequestSequenceRef = useRef(0);
  const selectedBatchIdRef = useRef<string | null>(null);
  const storeIdRef = useRef<string | null>(storeId);
  storeIdRef.current = storeId;

  const refreshBatches = useCallback(async () => {
    if (!api || !storeId) {
      batchesRequestSequenceRef.current += 1;
      setBatches([]);
      setBatchesError(null);
      setBatchesStatus("idle");
      return;
    }
    const requestedStoreId = storeId;
    const requestId = batchesRequestSequenceRef.current + 1;
    batchesRequestSequenceRef.current = requestId;
    setBatchesStatus("loading");
    setBatchesError(null);
    const result = await api.listImportBatchesV2(requestedStoreId);
    if (
      requestId !== batchesRequestSequenceRef.current ||
      storeIdRef.current !== requestedStoreId
    ) {
      return;
    }
    if (result.ok) {
      setBatches(result.value);
      setBatchesStatus("ready");
    } else {
      setBatchesError(result.error);
      setBatchesStatus("error");
    }
  }, [api, storeId]);

  useEffect(() => {
    void refreshBatches();
  }, [refreshBatches]);

  const refreshRecords = useCallback(async (batchId: string) => {
    if (!api || !storeId || selectedBatchIdRef.current !== batchId) return;
    const requestedStoreId = storeId;
    const requestId = recordsRequestSequenceRef.current + 1;
    recordsRequestSequenceRef.current = requestId;
    setRecordsStatus("loading");
    setRecordsError(null);
    const result = await api.listStagedRecordsV2(requestedStoreId, batchId);
    if (
      requestId !== recordsRequestSequenceRef.current ||
      storeIdRef.current !== requestedStoreId ||
      selectedBatchIdRef.current !== batchId
    ) {
      return;
    }
    if (result.ok) {
      setStagedRecords(result.value);
      setRecordsStatus("ready");
    } else {
      setRecordsError(result.error);
      setRecordsStatus("error");
    }
  }, [api, storeId]);

  const selectBatch = (batchId: string) => {
    selectedBatchIdRef.current = batchId;
    setSelectedBatchId(batchId);
    setStagedRecords([]);
    setRecordsError(null);
    setRecordsStatus("loading");
    setCandidateSelections({});
    void refreshRecords(batchId);
  };

  useEffect(() => {
    selectedBatchIdRef.current = null;
    recordsRequestSequenceRef.current += 1;
    setSelectedBatchId(null);
    setStagedRecords([]);
    setRecordsError(null);
    setRecordsStatus("idle");
  }, [storeId]);

  const parse = () => {
    const result = parseSellerCsv(source);
    if (result.ok) {
      setRecords(result.records);
      setParseError(null);
    } else {
      setRecords(null);
      setParseError(result.error);
    }
  };

  const changeFilename = (value: string) => {
    setFilename(value);
    setUploadError(null);
    setUploadStatus("idle");
  };

  const changeSource = (value: string) => {
    setSource(value);
    setRecords(null);
    setParseError(null);
    setUploadError(null);
    setUploadStatus("idle");
  };

  const parseErrorText = parseError?.code === "invalid_numeric_cell"
    ? t.sellerV2.imports.parseInvalidNumber(
        parseError.row ?? 0,
        parseError.column
          ? t.sellerV2.imports.parseNumericColumn[parseError.column]
          : ""
      )
    : parseError?.code === "missing_name_cell"
      ? t.sellerV2.imports.parseMissingNameCell(parseError.row ?? 0)
    : parseError?.code === "malformed_csv"
      ? t.sellerV2.imports.parseMalformed
      : t.sellerV2.imports.parseMissingName;

  const upload = async () => {
    if (!api || !storeId || !records?.length || !filename.trim() || uploadInFlightRef.current) return;
    const requestedStoreId = storeId;
    uploadInFlightRef.current = true;
    setUploadStatus("in-flight");
    setUploadError(null);
    const fingerprint = JSON.stringify({ filename: filename.trim(), records });
    if (uploadKeyRef.current?.fingerprint !== fingerprint) {
      uploadKeyRef.current = { fingerprint, key: generateOpaqueIdV2("csv-import") };
    }
    const result = await api.uploadImportBatchV2({
      filename: filename.trim(),
      idempotencyKey: uploadKeyRef.current.key,
      records,
      storeId: requestedStoreId,
    });
    uploadInFlightRef.current = false;
    if (storeIdRef.current !== requestedStoreId) {
      setUploadStatus("idle");
      return;
    }
    if (result.ok) {
      uploadKeyRef.current = null;
      setFilename("");
      setSource("");
      setRecords(null);
      setParseError(null);
      setUploadError(null);
      setUploadStatus("success");
      await refreshBatches();
    } else {
      setUploadError(result.error);
      setUploadStatus("error");
    }
  };

  const decide = async (
    record: StagedSourceRecordV2,
    decision: "approve" | "reject",
    targetStoreProductId: string | null
  ) => {
    if (!api || !storeId || !access.canApproveAndPublish || decisionsInFlightRef.current.has(record.id)) return;
    const requestedStoreId = storeId;
    decisionsInFlightRef.current.add(record.id);
    setDecisionStatuses((current) => ({ ...current, [record.id]: "in-flight" }));
    setDecisionErrors((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    const actionFingerprint = `${record.id}:${decision}:${targetStoreProductId ?? "new"}`;
    let key = decisionKeysRef.current.get(actionFingerprint);
    if (!key) {
      key = generateOpaqueIdV2("csv-decision");
      decisionKeysRef.current.set(actionFingerprint, key);
    }
    const result = await api.decideStagedRecordV2({
      decision,
      idempotencyKey: key,
      recordId: record.id,
      storeId: requestedStoreId,
      targetStoreProductId,
    });
    decisionsInFlightRef.current.delete(record.id);
    if (storeIdRef.current !== requestedStoreId) {
      setDecisionStatuses((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setDecisionErrors((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      return;
    }
    if (result.ok) {
      setDecisionStatuses((current) => ({ ...current, [record.id]: "success" }));
      await Promise.all([
        selectedBatchIdRef.current === record.batchId
          ? refreshRecords(record.batchId)
          : Promise.resolve(),
        refreshBatches(),
      ]);
    } else {
      setDecisionErrors((current) => ({ ...current, [record.id]: result.error }));
      setDecisionStatuses((current) => ({ ...current, [record.id]: "error" }));
      if (result.error.code === "invalid_state" || result.error.code === "not_found") {
        await Promise.all([
          selectedBatchIdRef.current === record.batchId
            ? refreshRecords(record.batchId)
            : Promise.resolve(),
          refreshBatches(),
        ]);
      }
    }
  };

  return (
    <AccessGateV2 access={access} screenTestId="import-v2">
      <ScreenScrollView contentContainerStyle={styles.container} testID="import-v2-screen">
        <Text style={styles.title}>{t.sellerV2.imports.title}</Text>
        <Text style={styles.notice} testID="import-v2-intro-notice">
          {t.sellerV2.imports.introNotice}
        </Text>
        {access.canRecordCount ? (
          <>
            <Text style={styles.label}>{t.sellerV2.imports.filenameLabel}</Text>
            <TextInput
              accessibilityLabel={t.sellerV2.imports.filenameLabel}
              editable={uploadStatus !== "in-flight"}
              onChangeText={changeFilename}
              style={styles.input}
              testID="import-v2-filename-input"
              value={filename}
            />
            <Text style={styles.label}>{t.sellerV2.imports.csvLabel}</Text>
            <TextInput
              accessibilityLabel={t.sellerV2.imports.csvLabel}
              editable={uploadStatus !== "in-flight"}
              multiline
              onChangeText={changeSource}
              style={[styles.input, styles.csvInput]}
              testID="import-v2-csv-input"
              value={source}
            />
            <Pressable
              accessibilityLabel={t.sellerV2.imports.parseButton}
              accessibilityRole="button"
              disabled={uploadStatus === "in-flight"}
              onPress={parse}
              style={styles.primaryButton}
              testID="import-v2-parse-button"
            >
              <Text style={styles.primaryButtonText}>{t.sellerV2.imports.parseButton}</Text>
            </Pressable>

            {parseError ? (
              <Text style={styles.errorText} testID="import-v2-parse-error">
                {parseErrorText}
              </Text>
            ) : null}

            {records ? (
              <View style={styles.section} testID="import-v2-preview">
                <Text style={styles.sectionTitle}>{t.sellerV2.imports.rowCount(records.length)}</Text>
                {records.length > 20 ? (
                  <Text style={styles.meta}>{t.sellerV2.imports.previewCap(20, records.length)}</Text>
                ) : null}
                {records.slice(0, 20).map((record, index) => (
                  <View key={`${record.rawName}-${index}`} style={styles.card} testID={`import-v2-preview-row-${index}`}>
                    <Text style={styles.cardTitle}>{record.rawName}</Text>
                    {record.rawBarcode ? <Text style={styles.meta}>{record.rawBarcode}</Text> : null}
                    {record.rawQuantity !== undefined ? <Text style={styles.meta}>{record.rawQuantity}</Text> : null}
                    {record.rawPrice !== undefined ? <Text style={styles.meta}>{record.rawPrice}</Text> : null}
                  </View>
                ))}
                <Pressable
                  accessibilityLabel={t.sellerV2.imports.uploadButton}
                  accessibilityRole="button"
                  disabled={!filename.trim() || records.length === 0 || uploadStatus === "in-flight"}
                  onPress={() => void upload()}
                  style={styles.primaryButton}
                  testID="import-v2-upload-button"
                >
                  <Text style={styles.primaryButtonText}>
                    {uploadStatus === "in-flight" ? t.sellerV2.imports.uploading : t.sellerV2.imports.uploadButton}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {uploadStatus === "success" ? (
              <Text style={styles.successText} testID="import-v2-upload-success">
                {t.sellerV2.imports.uploadSuccess}
              </Text>
            ) : null}
            {uploadStatus === "error" ? (
              <Text style={styles.errorText} testID="import-v2-upload-error">
                {uploadError?.message}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta} testID="import-v2-upload-forbidden">
            {t.sellerV2.imports.uploadForbidden}
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.sellerV2.imports.batchesTitle}</Text>
          {batchesStatus === "loading" || batchesStatus === "idle" ? (
            <View style={styles.loadingPanel} testID="import-v2-batches-loading">
              <ActivityIndicator color="#16C79A" />
              <Text style={styles.meta}>{t.sellerV2.imports.batchesLoading}</Text>
            </View>
          ) : null}
          {batchesStatus === "ready" && batches.length === 0 ? (
            <Text style={styles.meta} testID="import-v2-batches-empty">
              {t.sellerV2.imports.batchesEmpty}
            </Text>
          ) : null}
          {batchesStatus === "error" ? (
            <View style={styles.errorPanel} testID="import-v2-batches-error">
              <Text style={styles.errorText}>{batchesError?.message}</Text>
              <Pressable
                accessibilityLabel={t.sellerV2.imports.retry}
                accessibilityRole="button"
                onPress={() => void refreshBatches()}
                style={styles.retryButton}
                testID="import-v2-batches-retry"
              >
                <Text style={styles.retryText}>{t.sellerV2.imports.retry}</Text>
              </Pressable>
            </View>
          ) : null}
          {batches.map((batch) => (
            <Pressable
              accessibilityLabel={batch.filename}
              accessibilityRole="button"
              key={batch.id}
              onPress={() => selectBatch(batch.id)}
              style={[styles.card, selectedBatchId === batch.id ? styles.selectedCard : null]}
              testID={`import-v2-batch-${batch.id}`}
            >
              <Text style={styles.cardTitle}>{batch.filename}</Text>
              <Text style={styles.statusChip} testID={`import-v2-batch-status-${batch.id}`}>
                {t.sellerV2.imports.batchStatus[batch.status]}
              </Text>
              <Text style={styles.meta}>{t.sellerV2.imports.batchTotal(batch.totalRecords)}</Text>
              <Text style={styles.meta}>{t.sellerV2.imports.batchPending(batch.pendingRecords)}</Text>
            </Pressable>
          ))}
        </View>

        {selectedBatchId ? (
          <View style={styles.section} testID="import-v2-records-section">
            <Text style={styles.sectionTitle}>{t.sellerV2.imports.recordsTitle}</Text>
            {!access.canApproveAndPublish ? (
              <Text style={styles.meta} testID="import-v2-staff-review-note">
                {t.sellerV2.imports.staffReviewNote}
              </Text>
            ) : null}
            {recordsStatus === "loading" || recordsStatus === "idle" ? (
              <View style={styles.loadingPanel} testID="import-v2-records-loading">
                <ActivityIndicator color="#16C79A" />
                <Text style={styles.meta}>{t.sellerV2.imports.recordsLoading}</Text>
              </View>
            ) : null}
            {recordsStatus === "ready" && stagedRecords.length === 0 ? (
              <Text style={styles.meta} testID="import-v2-records-empty">
                {t.sellerV2.imports.recordsEmpty}
              </Text>
            ) : null}
            {recordsStatus === "error" ? (
              <View style={styles.errorPanel} testID="import-v2-records-error">
                <Text style={styles.errorText}>{recordsError?.message}</Text>
                <Pressable
                  accessibilityLabel={t.sellerV2.imports.retry}
                  accessibilityRole="button"
                  onPress={() => void refreshRecords(selectedBatchId)}
                  style={styles.retryButton}
                  testID="import-v2-records-retry"
                >
                  <Text style={styles.retryText}>{t.sellerV2.imports.retry}</Text>
                </Pressable>
              </View>
            ) : null}
            {recordsStatus === "ready" ? stagedRecords.map((record) => {
              const selectedTarget = candidateSelections[record.id] ?? record.matchedStoreProductId;
              return (
                <ImportRecordCardV2
                  canDecide={access.canApproveAndPublish}
                  decisionError={decisionErrors[record.id]}
                  decisionStatus={decisionStatuses[record.id]}
                  key={record.id}
                  onApproveNew={() => void decide(record, "approve", null)}
                  onApproveSelected={() => selectedTarget ? void decide(record, "approve", selectedTarget) : undefined}
                  onReject={() => void decide(record, "reject", null)}
                  onSelectCandidate={(storeProductId) =>
                    setCandidateSelections((current) => ({ ...current, [record.id]: storeProductId }))
                  }
                  record={record}
                  selectedTarget={selectedTarget}
                />
              );
            }) : null}
          </View>
        ) : null}
      </ScreenScrollView>
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  cardTitle: {
    color: "#111827",
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#F8F9FA",
    gap: 10,
    minHeight: "100%",
    padding: 16,
  },
  csvInput: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#B91C1C",
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  label: {
    color: "#374151",
    fontWeight: "700",
  },
  loadingPanel: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  notice: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderRadius: 10,
    borderWidth: 1,
    color: "#7C2D12",
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  section: {
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  selectedCard: {
    borderColor: "#16C79A",
    borderWidth: 2,
  },
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  successText: {
    color: "#047857",
    fontWeight: "700",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
  },
});
