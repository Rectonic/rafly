import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { CommandError, OwnerDigestV2 } from "@/lib/contracts";
import { formatDigestRu } from "@/lib/domain/digest-format";
import { useOptionalSellerApi } from "@/lib/seller/optional-context";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

export function OwnerDigestCardV2() {
  const api = useOptionalSellerApi();
  const access = useStoreMembershipV2();
  const t = useT();
  const [digest, setDigest] = useState<OwnerDigestV2 | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [loading, setLoading] = useState(false);

  if (access.access !== "granted" || !access.canApproveAndPublish) {
    return null;
  }

  const compose = async () => {
    const storeId = access.activeMembership?.storeId;
    if (!api || !storeId || loading) return;

    setLoading(true);
    setError(null);
    const result = await api.composeOwnerDigestV2(storeId);
    if (result.ok) {
      setDigest(result.value);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const message = digest ? formatDigestRu(digest) : null;

  return (
    <View style={styles.card} testID="owner-digest-v2-card">
      <Text style={styles.title}>{t.sellerV2.digest.title}</Text>
      <Text style={styles.subtitle}>{t.sellerV2.digest.subtitle}</Text>
      <Pressable
        accessibilityLabel={t.sellerV2.digest.composeButton}
        accessibilityRole="button"
        disabled={loading}
        onPress={() => void compose()}
        style={[styles.button, loading && styles.buttonDisabled]}
        testID="owner-digest-v2-compose-button"
      >
        <Text style={styles.buttonText}>
          {loading ? t.sellerV2.digest.loading : t.sellerV2.digest.composeButton}
        </Text>
      </Pressable>
      {loading ? <ActivityIndicator color="#047857" /> : null}
      {error ? (
        <View style={styles.errorPanel} testID="owner-digest-v2-error">
          <Text style={styles.errorText}>
            {error.message || t.sellerV2.digest.errorFallback}
          </Text>
          <Pressable
            accessibilityLabel={t.sellerV2.digest.retry}
            accessibilityRole="button"
            onPress={() => void compose()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t.sellerV2.digest.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {message ? (
        <View style={styles.sharePanel} testID="owner-digest-v2-result">
          <Text style={styles.copyHint}>{t.sellerV2.digest.copyHint}</Text>
          <Text
            selectable
            style={styles.shareText}
            testID="owner-digest-v2-share-text"
          >
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#047857",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A7F3D0",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 14,
  },
  copyHint: { color: "#047857", fontSize: 12, lineHeight: 16 },
  errorPanel: { gap: 8 },
  errorText: { color: "#B91C1C", fontSize: 13 },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: { color: "#B91C1C", fontWeight: "700" },
  sharePanel: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    gap: 8,
    padding: 12,
  },
  shareText: {
    color: "#111827",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  subtitle: { color: "#6B7280", fontSize: 13, lineHeight: 18 },
  title: { color: "#111827", fontSize: 17, fontWeight: "800" },
});
