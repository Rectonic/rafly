import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { MealPackageForm } from "@/components/seller/MealPackageForm";
import { useT } from "@/i18n";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";
import { useAuth } from "@/lib/seller/auth-store";
import { useSellerOffers } from "@/lib/seller/offers-store";
import {
  getSellerOfferValidationError,
  type SellerOfferValidationError,
} from "@/lib/seller/validation";
import type { MealPackageDraft } from "@/types/seller";
import type { LocalizedOfferContent } from "@/types/offer";

function parseListText(text: string | null | undefined) {
  return (text ?? "")
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDraftTranslations(
  draft: MealPackageDraft
): LocalizedOfferContent | undefined {
  const localizedSurpriseContents = {
    en: [en.seller.mealPackages.contentsVary],
    ru: [ru.seller.mealPackages.contentsVary],
  };
  const translations: LocalizedOfferContent = {};

  (["en", "ru"] as const).forEach((locale) => {
    const title = draft.translations?.[locale]?.title?.trim();
    const contents = draft.isSurpriseBag
      ? localizedSurpriseContents[locale]
      : parseListText(draft.translations?.[locale]?.contentsText ?? "");

    if (!title && contents.length === 0) {
      return;
    }

    translations[locale] = {
      contents: contents.length ? contents : undefined,
      title: title || undefined,
    };
  });

  return Object.keys(translations).length ? translations : undefined;
}

export default function CreateOfferScreen() {
  const t = useT();
  const { sellerProfile } = useAuth();
  const { error, isLoading, offers, publishOffer, refreshOffers } =
    useSellerOffers();
  const validationMessages: Record<SellerOfferValidationError, string> = {
    "invalid-pricing": t.seller.mealPackages.invalidPricing,
    "invalid-quantity": t.seller.mealPackages.invalidQuantity,
    "missing-fields": t.seller.mealPackages.invalidMissingFields,
  };

  const onSubmit = async (draft: MealPackageDraft) => {
    const contents = draft.isSurpriseBag
      ? [t.seller.mealPackages.contentsVary]
      : parseListText(draft.contentsText);
    const allergens = parseListText(draft.allergensText);
    const dietaryBadges = parseListText(draft.dietaryBadgesText);
    const oldPrice = Number(draft.oldPrice);
    const newPrice = Number(draft.newPrice);
    const quantity = Number.parseInt(draft.quantity, 10);
    const validationError = getSellerOfferValidationError({
      contents,
      newPrice,
      oldPrice,
      pickupEnd: draft.pickupEnd,
      quantity,
      title: draft.title,
    });

    if (validationError) {
      Alert.alert(
        t.seller.mealPackages.invalidTitle,
        validationMessages[validationError]
      );
      return;
    }

    try {
      await publishOffer({
        category: draft.category,
        allergens,
        cancellationPolicy: draft.cancellationPolicy?.trim() || undefined,
        contents,
        dietaryBadges,
        image: draft.image || null,
        newPrice,
        oldPrice,
        pickupEnd: draft.pickupEnd,
        pickupInstructions: draft.pickupInstructions?.trim() || undefined,
        pickupStart: draft.pickupStart || null,
        quantityAvailable: quantity,
        title: draft.title,
        translations: buildDraftTranslations(draft),
      });

      Alert.alert(
        t.seller.mealPackages.publishedTitle,
        t.seller.mealPackages.publishedMessage
      );
    } catch (publishError) {
      Alert.alert(
        t.seller.mealPackages.publishFailedTitle,
        publishError instanceof Error
          ? publishError.message
          : t.seller.mealPackages.publishFailedFallback
      );
    }
  };

  if (sellerProfile?.businessType === "shop") {
    return (
      <ScreenScrollView
        contentContainerStyle={styles.container}
        testID="create-offer-unavailable-screen"
      >
        <Text style={styles.title}>{t.seller.mealPackages.unavailableForShops}</Text>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="create-offer-screen"
    >
      <Text style={styles.title}>{t.seller.mealPackages.createTitle}</Text>
      <MealPackageForm isSubmitting={isLoading} onSubmit={onSubmit} />
      <Text style={styles.sectionTitle}>{t.seller.mealPackages.publishedOffers}</Text>
      {isLoading ? (
        <View style={styles.loadingPanel} testID="create-offer-loading-state">
          <Text style={styles.meta}>{t.seller.mealPackages.loadingOffers}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorPanel} testID="create-offer-error-state">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityLabel={t.seller.mealPackages.retryPublishedOffers}
            accessibilityRole="button"
            onPress={() => void refreshOffers()}
            style={styles.errorRetryButton}
            testID="create-offer-retry-button"
          >
            <Text style={styles.errorRetryText}>
              {t.seller.mealPackages.retryPublishedOffers}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {offers.map((offer) => (
        <Text key={offer.id} style={styles.item}>
          {offer.title} · {t.offer.portionsLeft(offer.quantityAvailable)}
        </Text>
      ))}
      {!isLoading && !error && offers.length === 0 ? (
        <Text style={styles.meta} testID="published-offers-empty-state">
          {t.seller.mealPackages.noPublishedOffers}
        </Text>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 10,
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
  item: {
    color: "#4B5563",
    marginTop: 8,
  },
  loadingPanel: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  meta: {
    color: "#6B7280",
    marginTop: 10,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
});
