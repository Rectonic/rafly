import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { useT } from "@/i18n";
import type { InventorySummaryV2 } from "@/lib/contracts";
import { formatIsoTimestampV2, parseLinesV2 } from "@/lib/seller/format-v2";
import { useStoreInventoryV2 } from "@/lib/seller/inventory-v2-store";
import { usePublishOfferV2, type PublishDraftInputV2 } from "@/lib/seller/publish-v2";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

function isEligible(item: InventorySummaryV2): boolean {
  // A depleted high confidence product has nothing safe left to offer.
  // Low and medium confidence products stay selectable, they can still
  // publish through an explicit physical set aside confirmation.
  return item.confidence !== "high" || item.maxOfferableQuantity > 0;
}

function parseIntOrNull(raw: string): number | null {
  if (raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export default function PublishV2Screen() {
  const access = useStoreMembershipV2();
  const storeId = access.activeMembership?.storeId ?? null;
  const inventory = useStoreInventoryV2(storeId);
  const session = usePublishOfferV2(storeId);
  const t = useT();

  const [step, setStep] = useState<"form" | "review">("form");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [physicallySetAside, setPhysicallySetAside] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [contentsText, setContentsText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [referencePriceText, setReferencePriceText] = useState("");
  const [pickupStart, setPickupStart] = useState("");
  const [pickupEnd, setPickupEnd] = useState("");
  const [allergensText, setAllergensText] = useState("");
  const [dietaryBadgesText, setDietaryBadgesText] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");

  const eligibleItems = inventory.items.filter(isEligible);
  const selectedProduct =
    eligibleItems.find((item) => item.storeProductId === selectedProductId) ?? null;

  const quantity = parseIntOrNull(quantityText);
  const quantityValid = quantity !== null && quantity > 0;
  const exceedsMax = Boolean(
    selectedProduct &&
      selectedProduct.confidence === "high" &&
      quantityValid &&
      quantity !== null &&
      quantity > selectedProduct.maxOfferableQuantity
  );
  const needsSetAside = Boolean(selectedProduct && selectedProduct.confidence !== "high");
  const setAsideMissing = needsSetAside && !physicallySetAside;

  const windowKnown = pickupStart.trim().length > 0 && pickupEnd.trim().length > 0;
  const startMs = Date.parse(pickupStart);
  const endMs = Date.parse(pickupEnd);
  const windowInvalid =
    windowKnown && (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs);

  const price = parseIntOrNull(priceText);
  const priceValid = price !== null && price > 0;
  const referencePrice = parseIntOrNull(referencePriceText);

  const canReview =
    Boolean(selectedProduct) &&
    quantityValid &&
    !exceedsMax &&
    !setAsideMissing &&
    windowKnown &&
    !windowInvalid &&
    title.trim().length > 0 &&
    priceValid;

  function buildInput(): PublishDraftInputV2 | null {
    if (!selectedProduct || quantity === null || price === null) return null;
    return {
      allergens: parseLinesV2(allergensText),
      allocation: {
        physicallySetAside,
        quantity,
        storeProductId: selectedProduct.storeProductId,
      },
      cancellationPolicy: cancellationPolicy.trim().length > 0 ? cancellationPolicy.trim() : null,
      category: category.trim().length > 0 ? category.trim() : "general",
      contents: parseLinesV2(contentsText),
      dietaryBadges: parseLinesV2(dietaryBadgesText),
      imageUrl: imageUrl.trim().length > 0 ? imageUrl.trim() : null,
      offerPriceUzs: price,
      pickupEnd,
      pickupInstructions:
        pickupInstructions.trim().length > 0 ? pickupInstructions.trim() : null,
      pickupStart,
      referencePriceUzs: referencePrice,
      title: title.trim(),
    };
  }

  const confirmPublish = () => {
    const input = buildInput();
    if (!input) return;
    void session.publish(input);
  };

  return (
    <AccessGateV2 access={access} screenTestId="publish-v2">
      {!access.canApproveAndPublish ? (
        <View style={styles.panel} testID="publish-v2-forbidden-state">
          <Text style={styles.forbiddenTitle}>{t.sellerV2.publish.forbiddenTitle}</Text>
          <Text style={styles.meta}>{t.sellerV2.publish.forbiddenMessage}</Text>
        </View>
      ) : (
        <ScreenScrollView contentContainerStyle={styles.container} testID="publish-v2-screen">
          <Text style={styles.title}>{t.sellerV2.publish.title}</Text>

          {session.status === "published" && session.offer ? (
            <View style={styles.publishedPanel} testID="publish-v2-published-panel">
              <Text style={styles.publishedTitle}>{t.sellerV2.publish.publishedTitle}</Text>
              <Text style={styles.meta}>{session.offer.title}</Text>
              <Text style={styles.meta}>
                {t.sellerV2.publish.publishedQuantity(session.offer.quantityAvailable)}
              </Text>
              {session.offer.discountPercent !== null ? (
                <Text style={styles.meta} testID="publish-v2-published-discount">
                  {t.sellerV2.publish.publishedDiscount(session.offer.discountPercent)}
                </Text>
              ) : (
                <Text style={styles.meta} testID="publish-v2-published-no-discount">
                  {t.sellerV2.publish.publishedNoDiscount}
                </Text>
              )}

              {session.offer.status === "paused" ? (
                <Text style={styles.pausedLabel} testID="publish-v2-paused-label">
                  {t.sellerV2.publish.pausedLabel}
                </Text>
              ) : (
                <Pressable
                  accessibilityLabel={t.sellerV2.publish.pauseButton}
                  accessibilityRole="button"
                  disabled={session.pauseStatus === "in-flight"}
                  onPress={() => void session.pause()}
                  style={styles.pauseButton}
                  testID="publish-v2-pause-button"
                >
                  <Text style={styles.pauseButtonText}>
                    {session.pauseStatus === "in-flight"
                      ? t.sellerV2.publish.pausing
                      : t.sellerV2.publish.pauseButton}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : step === "form" ? (
            <>
              <Text style={styles.sectionLabel}>{t.sellerV2.publish.selectProductTitle}</Text>
              {inventory.status === "loading" || inventory.status === "idle" ? (
                <ActivityIndicator color="#16C79A" />
              ) : null}
              {inventory.status === "ready" && eligibleItems.length === 0 ? (
                <Text style={styles.meta}>{t.sellerV2.publish.noEligibleProducts}</Text>
              ) : null}
              <View style={styles.chipRow}>
                {eligibleItems.map((item) => (
                  <Pressable
                    key={item.storeProductId}
                    onPress={() => setSelectedProductId(item.storeProductId)}
                    style={[
                      styles.chip,
                      selectedProductId === item.storeProductId ? styles.chipActive : null,
                    ]}
                    testID={`publish-v2-product-${item.storeProductId}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedProductId === item.storeProductId ? styles.chipTextActive : null,
                      ]}
                    >
                      {item.productName}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selectedProduct ? (
                <>
                  <Text style={styles.label}>{t.sellerV2.publish.quantityLabel}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setQuantityText}
                    style={styles.input}
                    testID="publish-v2-quantity-input"
                    value={quantityText}
                  />
                  {selectedProduct.confidence === "high" ? (
                    <Text style={styles.hint}>
                      {t.sellerV2.publish.maxOfferableHint(selectedProduct.maxOfferableQuantity)}
                    </Text>
                  ) : null}
                  {exceedsMax ? (
                    <Text style={styles.errorHint} testID="publish-v2-quantity-exceeds-max-hint">
                      {t.sellerV2.publish.quantityExceedsMaxHint}
                    </Text>
                  ) : null}

                  {needsSetAside ? (
                    <>
                      <Pressable
                        accessibilityLabel={t.sellerV2.publish.physicalSetAsideLabel}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: physicallySetAside }}
                        onPress={() => setPhysicallySetAside((current) => !current)}
                        style={[
                          styles.setAsideChip,
                          physicallySetAside ? styles.setAsideChipActive : null,
                        ]}
                        testID="publish-v2-physical-set-aside-toggle"
                      >
                        <Text
                          style={[
                            styles.setAsideChipText,
                            physicallySetAside ? styles.setAsideChipTextActive : null,
                          ]}
                        >
                          {t.sellerV2.publish.physicalSetAsideLabel}
                        </Text>
                      </Pressable>
                      <Text style={styles.hint}>{t.sellerV2.publish.physicalSetAsideHint}</Text>
                      {setAsideMissing ? (
                        <Text
                          style={styles.errorHint}
                          testID="publish-v2-set-aside-required-hint"
                        >
                          {t.sellerV2.publish.physicalSetAsideRequiredHint}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}

              <Text style={styles.label}>{t.sellerV2.publish.titleLabel}</Text>
              <TextInput
                onChangeText={setTitle}
                style={styles.input}
                testID="publish-v2-title-input"
                value={title}
              />

              <Text style={styles.label}>{t.sellerV2.publish.categoryLabel}</Text>
              <TextInput
                onChangeText={setCategory}
                style={styles.input}
                testID="publish-v2-category-input"
                value={category}
              />

              <Text style={styles.label}>{t.sellerV2.publish.imageUrlLabel}</Text>
              <TextInput
                onChangeText={setImageUrl}
                style={styles.input}
                testID="publish-v2-image-url-input"
                value={imageUrl}
              />

              <Text style={styles.label}>{t.sellerV2.publish.contentsLabel}</Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setContentsText}
                placeholder={t.sellerV2.publish.contentsPlaceholder}
                style={[styles.input, styles.multiInput]}
                testID="publish-v2-contents-input"
                value={contentsText}
              />

              <Text style={styles.label}>{t.sellerV2.publish.priceLabel}</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setPriceText}
                style={styles.input}
                testID="publish-v2-price-input"
                value={priceText}
              />

              <Text style={styles.label}>{t.sellerV2.publish.referencePriceLabel}</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setReferencePriceText}
                style={styles.input}
                testID="publish-v2-reference-price-input"
                value={referencePriceText}
              />

              <Text style={styles.label}>{t.sellerV2.publish.pickupStartLabel}</Text>
              <TextInput
                onChangeText={setPickupStart}
                style={styles.input}
                testID="publish-v2-pickup-start-input"
                value={pickupStart}
              />

              <Text style={styles.label}>{t.sellerV2.publish.pickupEndLabel}</Text>
              <TextInput
                onChangeText={setPickupEnd}
                style={styles.input}
                testID="publish-v2-pickup-end-input"
                value={pickupEnd}
              />
              {windowInvalid ? (
                <Text style={styles.errorHint} testID="publish-v2-pickup-window-invalid-hint">
                  {t.sellerV2.publish.pickupWindowInvalidHint}
                </Text>
              ) : null}

              <Text style={styles.label}>{t.sellerV2.publish.allergensLabel}</Text>
              <TextInput
                multiline
                numberOfLines={2}
                onChangeText={setAllergensText}
                style={[styles.input, styles.multiInputShort]}
                testID="publish-v2-allergens-input"
                value={allergensText}
              />

              <Text style={styles.label}>{t.sellerV2.publish.dietaryBadgesLabel}</Text>
              <TextInput
                multiline
                numberOfLines={2}
                onChangeText={setDietaryBadgesText}
                style={[styles.input, styles.multiInputShort]}
                testID="publish-v2-dietary-badges-input"
                value={dietaryBadgesText}
              />

              <Text style={styles.label}>{t.sellerV2.publish.pickupInstructionsLabel}</Text>
              <TextInput
                multiline
                numberOfLines={2}
                onChangeText={setPickupInstructions}
                style={[styles.input, styles.multiInputShort]}
                testID="publish-v2-pickup-instructions-input"
                value={pickupInstructions}
              />

              <Text style={styles.label}>{t.sellerV2.publish.cancellationPolicyLabel}</Text>
              <TextInput
                multiline
                numberOfLines={2}
                onChangeText={setCancellationPolicy}
                style={[styles.input, styles.multiInputShort]}
                testID="publish-v2-cancellation-policy-input"
                value={cancellationPolicy}
              />

              <Pressable
                accessibilityLabel={t.sellerV2.publish.reviewButton}
                accessibilityRole="button"
                disabled={!canReview}
                onPress={() => canReview && setStep("review")}
                style={[styles.primaryButton, !canReview ? styles.disabledButton : null]}
                testID="publish-v2-review-button"
              >
                <Text style={styles.primaryButtonText}>{t.sellerV2.publish.reviewButton}</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.reviewPanel} testID="publish-v2-review-panel">
              <Text style={styles.sectionLabel}>{t.sellerV2.publish.reviewTitle}</Text>
              <Text style={styles.meta}>{title}</Text>
              <Text style={styles.meta} testID="publish-v2-review-product">
                {t.sellerV2.publish.reviewProduct(selectedProduct?.productName ?? "")}
              </Text>
              <Text style={styles.meta} testID="publish-v2-review-quantity">
                {t.sellerV2.publish.reviewQuantity(quantity ?? 0)}
              </Text>
              <Text style={styles.meta} testID="publish-v2-review-price">
                {t.sellerV2.publish.reviewPrice(price ?? 0)}
              </Text>
              <Text style={styles.meta} testID="publish-v2-review-reference-price">
                {referencePrice !== null
                  ? t.sellerV2.publish.reviewReferencePrice(referencePrice)
                  : t.sellerV2.publish.reviewNoReferencePrice}
              </Text>
              <Text style={styles.meta} testID="publish-v2-review-pickup-window">
                {t.sellerV2.publish.reviewPickupWindow(
                  formatIsoTimestampV2(pickupStart),
                  formatIsoTimestampV2(pickupEnd)
                )}
              </Text>
              {needsSetAside ? (
                <Text style={styles.meta}>{t.sellerV2.publish.reviewSetAsideConfirmed}</Text>
              ) : null}

              {session.status === "error" ? (
                <View style={styles.errorPanel} testID="publish-v2-publish-error">
                  <Text style={styles.errorText}>
                    {session.submitError?.message ?? t.sellerV2.publish.errorFallback}
                  </Text>
                  <Pressable
                    accessibilityLabel={t.sellerV2.publish.retry}
                    accessibilityRole="button"
                    onPress={confirmPublish}
                    style={styles.errorRetryButton}
                    testID="publish-v2-publish-retry-button"
                  >
                    <Text style={styles.errorRetryText}>{t.sellerV2.publish.retry}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.reviewActions}>
                <Pressable
                  accessibilityLabel={t.sellerV2.publish.backButton}
                  accessibilityRole="button"
                  onPress={() => setStep("form")}
                  style={styles.secondaryButton}
                  testID="publish-v2-back-button"
                >
                  <Text style={styles.secondaryButtonText}>{t.sellerV2.publish.backButton}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={t.sellerV2.publish.confirmButton}
                  accessibilityRole="button"
                  disabled={session.status === "submitting"}
                  onPress={confirmPublish}
                  style={styles.primaryButton}
                  testID="publish-v2-confirm-button"
                >
                  <Text style={styles.primaryButtonText}>
                    {session.status === "submitting"
                      ? t.sellerV2.publish.publishing
                      : t.sellerV2.publish.confirmButton}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScreenScrollView>
      )}
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#16C79A",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chipText: {
    color: "#111827",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorHint: {
    color: "#B91C1C",
    fontSize: 12,
    marginBottom: 8,
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
  hint: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  multiInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  multiInputShort: {
    minHeight: 56,
    textAlignVertical: "top",
  },
  panel: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  pauseButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pauseButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  pausedLabel: {
    color: "#B91C1C",
    fontWeight: "700",
    marginTop: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    flex: 1,
    marginTop: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  publishedPanel: {
    backgroundColor: "#ECFDF5",
    borderColor: "#16C79A",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  publishedTitle: {
    color: "#065F46",
    fontSize: 18,
    fontWeight: "800",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  reviewPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#16C79A",
    borderRadius: 12,
    flex: 1,
    marginTop: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#047857",
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  setAsideChip: {
    alignSelf: "flex-start",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  setAsideChipActive: {
    backgroundColor: "#16C79A",
    borderColor: "#16C79A",
  },
  setAsideChipText: {
    color: "#111827",
    fontWeight: "600",
  },
  setAsideChipTextActive: {
    color: "#FFFFFF",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
});
