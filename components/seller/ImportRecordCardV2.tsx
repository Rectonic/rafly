import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { CommandError, StagedSourceRecordV2 } from "@/lib/contracts";

type DecisionStatus = "in-flight" | "error" | "success" | undefined;

type ImportRecordCardV2Props = {
  canDecide: boolean;
  decisionError?: CommandError;
  decisionStatus: DecisionStatus;
  onApproveNew: () => void;
  onApproveSelected: () => void;
  onReject: () => void;
  onSelectCandidate: (storeProductId: string) => void;
  record: StagedSourceRecordV2;
  selectedTarget: string | null;
};

export function ImportRecordCardV2({
  canDecide,
  decisionError,
  decisionStatus,
  onApproveNew,
  onApproveSelected,
  onReject,
  onSelectCandidate,
  record,
  selectedTarget,
}: ImportRecordCardV2Props) {
  const t = useT();
  const terminal = record.matchStatus === "approved" || record.matchStatus === "rejected";

  const candidateReasonLabel = (reason: string) => {
    if (reason === "barcode" || reason === "alias" || reason === "product_name") {
      return t.sellerV2.imports.candidateReason[reason];
    }
    return reason;
  };

  return (
    <View style={styles.card} testID={`import-v2-record-${record.id}`}>
      <Text style={styles.cardTitle}>{record.rawName}</Text>
      <Text style={styles.meta}>
        {t.sellerV2.imports.rawBarcode(record.rawBarcode ?? t.sellerV2.imports.missingValue)}
      </Text>
      <Text style={styles.meta}>
        {record.rawQuantity === null
          ? t.sellerV2.imports.rawQuantityLabelMissing
          : t.sellerV2.imports.rawQuantity(record.rawQuantity)}
      </Text>
      <Text style={styles.meta}>
        {record.rawPrice === null
          ? t.sellerV2.imports.rawPriceLabelMissing
          : t.sellerV2.imports.rawPrice(record.rawPrice)}
      </Text>
      <Text style={styles.statusChip} testID={`import-v2-record-status-${record.id}`}>
        {t.sellerV2.imports.matchStatus[record.matchStatus]}
      </Text>

      {record.candidates.length > 0 ? (
        <View style={styles.candidates}>
          <Text style={styles.label}>{t.sellerV2.imports.candidatesTitle}</Text>
          {record.candidates.map((candidate) => {
            const selected = selectedTarget === candidate.storeProductId;
            const reasonLabel = candidateReasonLabel(candidate.reason);
            return (
              <Pressable
                accessibilityLabel={`${candidate.productName}, ${reasonLabel}`}
                accessibilityRole="button"
                key={candidate.storeProductId}
                onPress={() => onSelectCandidate(candidate.storeProductId)}
                style={[styles.candidateButton, selected ? styles.selectedCandidate : null]}
                testID={`import-v2-candidate-${record.id}-${candidate.storeProductId}`}
              >
                <Text style={styles.cardTitle}>{candidate.productName}</Text>
                <Text style={styles.meta}>{reasonLabel}</Text>
                <Text style={styles.meta}>
                  {selected ? t.sellerV2.imports.selectedCandidate : t.sellerV2.imports.selectCandidate}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {canDecide && !terminal ? (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityLabel={t.sellerV2.imports.approveSelected}
            accessibilityRole="button"
            disabled={!selectedTarget || decisionStatus === "in-flight"}
            onPress={onApproveSelected}
            style={styles.secondaryButton}
            testID={`import-v2-approve-${record.id}`}
          >
            <Text style={styles.secondaryButtonText}>
              {decisionStatus === "in-flight"
                ? t.sellerV2.imports.deciding
                : t.sellerV2.imports.approveSelected}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t.sellerV2.imports.approveNew}
            accessibilityRole="button"
            disabled={decisionStatus === "in-flight"}
            onPress={onApproveNew}
            style={styles.secondaryButton}
            testID={`import-v2-approve-new-${record.id}`}
          >
            <Text style={styles.secondaryButtonText}>{t.sellerV2.imports.approveNew}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t.sellerV2.imports.reject}
            accessibilityRole="button"
            disabled={decisionStatus === "in-flight"}
            onPress={onReject}
            style={styles.rejectButton}
            testID={`import-v2-reject-${record.id}`}
          >
            <Text style={styles.rejectButtonText}>{t.sellerV2.imports.reject}</Text>
          </Pressable>
        </View>
      ) : null}

      {decisionStatus === "error" ? (
        <Text style={styles.errorText} testID={`import-v2-decision-error-${record.id}`}>
          {decisionError?.message}
        </Text>
      ) : null}
      {decisionStatus === "success" ? (
        <Text style={styles.successText} testID={`import-v2-decision-success-${record.id}`}>
          {t.sellerV2.imports.decisionSuccess}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  candidateButton: {
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    padding: 10,
  },
  candidates: {
    gap: 6,
    marginTop: 4,
  },
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
  errorText: {
    color: "#B91C1C",
  },
  label: {
    color: "#374151",
    fontWeight: "700",
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  rejectButton: {
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rejectButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  secondaryButton: {
    borderColor: "#16C79A",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#047857",
    fontWeight: "700",
  },
  selectedCandidate: {
    backgroundColor: "#ECFDF5",
    borderColor: "#16C79A",
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
});
