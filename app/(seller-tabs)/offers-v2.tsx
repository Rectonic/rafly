import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { useT } from "@/i18n";
import type { MarketplaceOfferStatusV2 } from "@/lib/contracts";
import { formatIsoTimestampV2 } from "@/lib/seller/format-v2";
import { useStoreOffersV2, usePauseOfferActionV2 } from "@/lib/seller/offers-v2-store";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

/**
 * Fix round 1, finding 7. Every offer the store has published, every
 * status, so a manager can find and pause a live offer without still
 * having the publish screen's local session state around, that state is
 * gone the moment the seller navigates away or the app restarts.
 */
export default function OffersV2Screen() {
  const access = useStoreMembershipV2();
  const storeId = access.activeMembership?.storeId ?? null;
  const offers = useStoreOffersV2(storeId);
  const pauseAction = usePauseOfferActionV2(storeId);
  const t = useT();

  const statusLabel = (status: MarketplaceOfferStatusV2) => t.sellerV2.offers.statusLabel[status];

  const handlePause = (offer: (typeof offers.offers)[number]) => {
    // The pause button already only renders for a role that can approve
    // and publish, this check is the second, independent guard so the
    // handler itself never trusts the button was the only gate.
    if (!access.canApproveAndPublish) return;
    void pauseAction.pause(offer);
  };

  return (
    <AccessGateV2 access={access} screenTestId="offers-v2">
      <ScreenScrollView contentContainerStyle={styles.container} testID="offers-v2-screen">
        <Text style={styles.title}>{t.sellerV2.offers.title}</Text>

        {offers.status === "loading" || offers.status === "idle" ? (
          <View style={styles.panel} testID="offers-v2-loading-state">
            <ActivityIndicator color="#16C79A" />
            <Text style={styles.meta}>{t.sellerV2.offers.loading}</Text>
          </View>
        ) : null}

        {offers.status === "error" ? (
          <View style={styles.errorPanel} testID="offers-v2-error-state">
            <Text style={styles.errorText}>
              {offers.error?.message ?? t.sellerV2.offers.errorTitle}
            </Text>
            <Pressable
              accessibilityLabel={t.sellerV2.offers.retry}
              accessibilityRole="button"
              onPress={() => void offers.refresh()}
              style={styles.errorRetryButton}
              testID="offers-v2-retry-button"
            >
              <Text style={styles.errorRetryText}>{t.sellerV2.offers.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {offers.status === "ready" && offers.offers.length === 0 ? (
          <View style={styles.panel} testID="offers-v2-empty-state">
            <Text style={styles.meta}>{t.sellerV2.offers.emptyTitle}</Text>
            <Text style={styles.meta}>{t.sellerV2.offers.emptyHint}</Text>
          </View>
        ) : null}

        {offers.status === "ready"
          ? offers.offers.map((offer) => {
              const pauseStatus = pauseAction.statusFor(offer.id);
              const isPaused = offer.status === "paused" || pauseStatus === "paused";
              const canPause = offer.status === "live" && !isPaused;

              return (
                <View key={offer.id} style={styles.row} testID={`offers-v2-row-${offer.id}`}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.meta} testID={`offers-v2-status-${offer.id}`}>
                    {statusLabel(isPaused ? "paused" : offer.status)}
                  </Text>
                  <Text style={styles.meta}>
                    {t.sellerV2.offers.quantityLabel(offer.quantityAvailable)}
                  </Text>
                  <Text style={styles.meta} testID={`offers-v2-pickup-window-${offer.id}`}>
                    {t.sellerV2.offers.pickupWindowLabel(
                      formatIsoTimestampV2(offer.pickupStart),
                      formatIsoTimestampV2(offer.pickupEnd)
                    )}
                  </Text>

                  {access.canApproveAndPublish && canPause ? (
                    <Pressable
                      accessibilityLabel={t.sellerV2.offers.pauseButton}
                      accessibilityRole="button"
                      disabled={pauseStatus === "in-flight"}
                      onPress={() => handlePause(offer)}
                      style={styles.pauseButton}
                      testID={`offers-v2-pause-${offer.id}`}
                    >
                      <Text style={styles.pauseButtonText}>
                        {pauseStatus === "in-flight"
                          ? t.sellerV2.offers.pausing
                          : t.sellerV2.offers.pauseButton}
                      </Text>
                    </Pressable>
                  ) : null}

                  {pauseStatus === "error" ? (
                    <Text
                      style={styles.errorHint}
                      testID={`offers-v2-pause-error-${offer.id}`}
                    >
                      {pauseAction.errorFor(offer.id)?.message ??
                        t.sellerV2.offers.pauseErrorFallback}
                    </Text>
                  ) : null}
                </View>
              );
            })
          : null}
      </ScreenScrollView>
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  errorHint: {
    color: "#B91C1C",
    fontSize: 12,
    marginTop: 4,
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
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
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  offerTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  panel: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  pauseButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pauseButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  row: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginBottom: 10,
    padding: 14,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
});
