import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { useT } from "@/i18n";
import type { ExpiryWatchItemV2 } from "@/lib/contracts";
import {
  OFFER_CANDIDATE_EXPIRY_ACTION,
  suggestExpiryAction,
} from "@/lib/domain/expiry-rules";
import { useExpiryWatchlistV2 } from "@/lib/seller/expiry-watchlist-v2-store";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

const CORAL = "#FF6B6B";
const AMBER = "#E0A63C";
const INK = "#101418";

function urgencyColor(daysToExpiry: number): string {
  if (daysToExpiry <= 0) return CORAL;
  if (daysToExpiry <= 3) return AMBER;
  return INK;
}

interface ExpiryWatchRowProps {
  canPublish: boolean;
  canRecount: boolean;
  item: ExpiryWatchItemV2;
  onPublish: () => void;
  onRecount: (storeProductId: string) => void;
}

function ExpiryWatchRow({
  canPublish,
  canRecount,
  item,
  onPublish,
  onRecount,
}: ExpiryWatchRowProps) {
  const t = useT();
  const suggestion = suggestExpiryAction(item.daysToExpiry, item.confidence);
  const offerCandidate = suggestion.action === OFFER_CANDIDATE_EXPIRY_ACTION;

  return (
    <View style={styles.card} testID={`expiry-v2-row-${item.storeProductId}`}>
      <Text style={styles.productName}>{item.productName}</Text>
      <Text
        style={[styles.days, { color: urgencyColor(item.daysToExpiry) }]}
        testID={`expiry-v2-days-${item.storeProductId}`}
      >
        {t.sellerV2.expiry.daysLabel(item.daysToExpiry)}
      </Text>
      <Text style={styles.meta}>{t.sellerV2.expiry.expiryLabel(item.expiryDate)}</Text>
      <Text style={styles.meta}>{t.sellerV2.expiry.onHandLabel(item.onHandQuantity)}</Text>

      <View style={styles.chips}>
        <Text
          style={styles.suggestionChip}
          testID={`expiry-v2-suggestion-${item.storeProductId}`}
        >
          {suggestion.action}
        </Text>
        {suggestion.requiresRecount ? (
          canRecount ? (
            <Pressable
              accessibilityLabel={t.sellerV2.expiry.recountAction}
              accessibilityRole="button"
              onPress={() => onRecount(item.storeProductId)}
              style={styles.recountChip}
              testID={`expiry-v2-recount-${item.storeProductId}`}
            >
              <Text style={styles.recountChipText}>
                {t.sellerV2.expiry.recountAction}
              </Text>
            </Pressable>
          ) : (
            <Text
              style={styles.recountChip}
              testID={`expiry-v2-recount-note-${item.storeProductId}`}
            >
              {t.sellerV2.expiry.recountAction}
            </Text>
          )
        ) : null}
      </View>

      {item.hasOpenExceptions ? (
        <Text style={styles.exceptionText}>{t.sellerV2.expiry.openException}</Text>
      ) : null}
      {item.activeOfferId ? (
        <Text style={styles.activeOfferText}>{t.sellerV2.expiry.activeOffer}</Text>
      ) : null}
      {offerCandidate && canPublish ? (
        <Pressable
          accessibilityLabel={t.sellerV2.expiry.publishAction}
          accessibilityRole="link"
          onPress={onPublish}
          style={styles.linkButton}
          testID={`expiry-v2-publish-${item.storeProductId}`}
        >
          <Text style={styles.linkText}>{t.sellerV2.expiry.publishAction}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ExpiryV2Screen() {
  const access = useStoreMembershipV2();
  const storeId =
    access.access === "granted"
      ? (access.activeMembership?.storeId ?? null)
      : null;
  const watchlist = useExpiryWatchlistV2(storeId);
  const router = useRouter();
  const t = useT();

  const goToRecount = (storeProductId: string) => {
    if (!access.canRecordCount) return;
    router.push({
      pathname: "/(seller-tabs)/count-session-v2",
      params: { storeProductId },
    });
  };

  const goToPublish = () => {
    if (!access.canApproveAndPublish) return;
    router.push("/(seller-tabs)/publish-v2");
  };

  return (
    <AccessGateV2 access={access} screenTestId="expiry-v2">
      <ScreenScrollView
        contentContainerStyle={styles.container}
        testID="expiry-v2-screen"
      >
        <Text style={styles.title}>{t.sellerV2.expiry.title}</Text>

        {watchlist.status === "loading" || watchlist.status === "idle" ? (
          <View style={styles.panel} testID="expiry-v2-loading-state">
            <ActivityIndicator color="#16C79A" />
            <Text style={styles.meta}>{t.sellerV2.expiry.loading}</Text>
          </View>
        ) : null}

        {watchlist.status === "error" ? (
          <View style={styles.errorPanel} testID="expiry-v2-error-state">
            <Text style={styles.errorText}>
              {watchlist.error?.message ?? t.sellerV2.expiry.errorTitle}
            </Text>
            <Pressable
              accessibilityLabel={t.sellerV2.expiry.retry}
              accessibilityRole="button"
              onPress={() => void watchlist.refresh()}
              style={styles.retryButton}
              testID="expiry-v2-retry-button"
            >
              <Text style={styles.retryText}>{t.sellerV2.expiry.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {watchlist.status === "ready" ? (
          <>
            <Text style={styles.summary} testID="expiry-v2-item-summary">
              {t.sellerV2.expiry.itemCount(watchlist.items.length)}
            </Text>
            {watchlist.items.length === 0 ? (
              <View style={styles.panel} testID="expiry-v2-empty-state">
                <Text style={styles.emptyTitle}>{t.sellerV2.expiry.emptyTitle}</Text>
                <Text style={styles.meta}>{t.sellerV2.expiry.emptyHint}</Text>
              </View>
            ) : (
              watchlist.items.map((item) => (
                <ExpiryWatchRow
                  canPublish={access.canApproveAndPublish}
                  canRecount={access.canRecordCount}
                  item={item}
                  key={item.storeProductId}
                  onPublish={goToPublish}
                  onRecount={goToRecount}
                />
              ))
            )}
          </>
        ) : null}
      </ScreenScrollView>
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  activeOfferText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E7EA",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  days: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyTitle: {
    color: INK,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorPanel: {
    backgroundColor: "#FFF2F2",
    borderColor: "#FFB7B7",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  errorText: {
    color: "#B42318",
  },
  exceptionText: {
    color: CORAL,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  linkButton: {
    alignSelf: "flex-start",
    borderColor: "#16C79A",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkText: {
    color: "#047857",
    fontWeight: "700",
  },
  meta: {
    color: "#667078",
    fontSize: 13,
    marginBottom: 4,
  },
  panel: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
  },
  productName: {
    color: INK,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  recountChip: {
    backgroundColor: "#FFF3D9",
    borderRadius: 999,
    color: "#7A4D00",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recountChipText: {
    color: "#7A4D00",
    fontSize: 12,
    fontWeight: "700",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B42318",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#B42318",
    fontWeight: "700",
  },
  suggestionChip: {
    backgroundColor: "#E9FBF5",
    borderRadius: 999,
    color: "#066B52",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summary: {
    color: "#667078",
    marginBottom: 12,
  },
  title: {
    color: INK,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
});
