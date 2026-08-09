import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useT } from "@/i18n";
import type { Locale } from "@/i18n";
import type { MealPackageDraft } from "@/types/seller";
import type { OfferCategory } from "@/types/offer";

const CATEGORIES: OfferCategory[] = [
  "Meals",
  "Baked Goods",
  "Groceries",
  "Vegan",
  "Surprise Bags",
];

const DEFAULT_DRAFT: MealPackageDraft = {
  title: "",
  category: "Meals",
  oldPrice: "",
  newPrice: "",
  quantity: "",
  pickupStart: "18:00",
  pickupEnd: "21:00",
  image: "",
  contentsText: "",
  allergensText: "",
  cancellationPolicy: "",
  dietaryBadgesText: "",
  pickupInstructions: "",
  isSurpriseBag: false,
};

type MealPackageFormProps = {
  isSubmitting: boolean;
  onSubmit: (draft: MealPackageDraft) => Promise<void>;
};

export function MealPackageForm({
  isSubmitting,
  onSubmit,
}: MealPackageFormProps) {
  const t = useT();
  const [draft, setDraft] = useState<MealPackageDraft>(DEFAULT_DRAFT);

  const updateDraft = <Key extends keyof MealPackageDraft>(
    key: Key,
    value: MealPackageDraft[Key]
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateTranslation = (
    locale: Locale,
    key: "contentsText" | "title",
    value: string
  ) => {
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: {
          ...current.translations?.[locale],
          [key]: value,
        },
      },
    }));
  };

  const pickImage = async (source: "camera" | "library") => {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            mediaTypes: ["images"],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            mediaTypes: ["images"],
            quality: 0.7,
          });

    if (!result.canceled && result.assets[0]) {
      updateDraft("image", result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t.seller.mealPackages.packageTitle}</Text>
      <TextInput
        onChangeText={(value) => updateDraft("title", value)}
        placeholder={t.seller.mealPackages.packageTitlePlaceholder}
        style={styles.input}
        testID="meal-form-title-input"
        value={draft.title}
      />

      <Text style={styles.sectionLabel}>
        {t.seller.mealPackages.translationsTitle}
      </Text>
      <Text style={styles.label}>{t.seller.mealPackages.titleEn}</Text>
      <TextInput
        onChangeText={(value) => updateTranslation("en", "title", value)}
        placeholder={t.seller.mealPackages.packageTitlePlaceholder}
        style={styles.input}
        testID="meal-form-title-en-input"
        value={draft.translations?.en?.title ?? ""}
      />
      <Text style={styles.label}>{t.seller.mealPackages.titleRu}</Text>
      <TextInput
        onChangeText={(value) => updateTranslation("ru", "title", value)}
        placeholder="Вечерний набор пасты"
        style={styles.input}
        testID="meal-form-title-ru-input"
        value={draft.translations?.ru?.title ?? ""}
      />

      <Text style={styles.label}>{t.seller.mealPackages.category}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <Pressable
              accessibilityLabel={t.seller.mealPackages.selectCategory(
                t.categories[category]
              )}
              accessibilityRole="button"
              key={category}
              onPress={() => updateDraft("category", category)}
              style={[
                styles.chip,
                draft.category === category ? styles.chipActive : null,
              ]}
              testID={`meal-form-category-${category}`}
            >
              <Text
                style={[
                  styles.chipText,
                  draft.category === category ? styles.chipTextActive : null,
                ]}
              >
                {t.categories[category]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t.seller.mealPackages.useCamera}
          accessibilityRole="button"
          onPress={() => void pickImage("camera")}
          style={styles.secondaryButton}
          testID="meal-form-camera-button"
        >
          <Text style={styles.secondaryButtonText}>
            {t.seller.mealPackages.useCamera}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.seller.mealPackages.choosePhoto}
          accessibilityRole="button"
          onPress={() => void pickImage("library")}
          style={styles.secondaryButton}
          testID="meal-form-photo-button"
        >
          <Text style={styles.secondaryButtonText}>
            {t.seller.mealPackages.choosePhoto}
          </Text>
        </Pressable>
      </View>
      {draft.image ? <Text style={styles.meta}>{draft.image}</Text> : null}

      <View style={styles.switchRow}>
        <Text style={styles.label}>{t.seller.mealPackages.surpriseBag}</Text>
        <Switch
          onValueChange={(value) => updateDraft("isSurpriseBag", value)}
          testID="meal-form-surprise-switch"
          value={draft.isSurpriseBag}
        />
      </View>

      {!draft.isSurpriseBag ? (
        <>
          <Text style={styles.label}>{t.seller.mealPackages.contents}</Text>
          <TextInput
            multiline
            numberOfLines={4}
            onChangeText={(value) => updateDraft("contentsText", value)}
            placeholder={t.seller.mealPackages.contentsPlaceholder}
            style={[styles.input, styles.multiInput]}
            testID="meal-form-contents-input"
            value={draft.contentsText}
          />
          <Text style={styles.label}>{t.seller.mealPackages.contentsEn}</Text>
          <TextInput
            multiline
            numberOfLines={4}
            onChangeText={(value) =>
              updateTranslation("en", "contentsText", value)
            }
            placeholder={t.seller.mealPackages.contentsPlaceholder}
            style={[styles.input, styles.multiInput]}
            testID="meal-form-contents-en-input"
            value={draft.translations?.en?.contentsText ?? ""}
          />
          <Text style={styles.label}>{t.seller.mealPackages.contentsRu}</Text>
          <TextInput
            multiline
            numberOfLines={4}
            onChangeText={(value) =>
              updateTranslation("ru", "contentsText", value)
            }
            placeholder="Паста\nЧесночный хлеб"
            style={[styles.input, styles.multiInput]}
            testID="meal-form-contents-ru-input"
            value={draft.translations?.ru?.contentsText ?? ""}
          />
        </>
      ) : null}

      <Text style={styles.sectionLabel}>
        {t.seller.mealPackages.pickupInstructions}
      </Text>
      <TextInput
        multiline
        numberOfLines={3}
        onChangeText={(value) => updateDraft("pickupInstructions", value)}
        placeholder={t.seller.mealPackages.pickupInstructionsPlaceholder}
        style={[styles.input, styles.multiInputShort]}
        testID="meal-form-pickup-instructions-input"
        value={draft.pickupInstructions}
      />

      <Text style={styles.label}>{t.seller.mealPackages.dietaryBadges}</Text>
      <TextInput
        multiline
        numberOfLines={3}
        onChangeText={(value) => updateDraft("dietaryBadgesText", value)}
        placeholder={t.seller.mealPackages.dietaryBadgesPlaceholder}
        style={[styles.input, styles.multiInputShort]}
        testID="meal-form-dietary-badges-input"
        value={draft.dietaryBadgesText}
      />

      <Text style={styles.label}>{t.seller.mealPackages.allergens}</Text>
      <TextInput
        multiline
        numberOfLines={3}
        onChangeText={(value) => updateDraft("allergensText", value)}
        placeholder={t.seller.mealPackages.allergensPlaceholder}
        style={[styles.input, styles.multiInputShort]}
        testID="meal-form-allergens-input"
        value={draft.allergensText}
      />

      <Text style={styles.label}>{t.seller.mealPackages.cancellationPolicy}</Text>
      <TextInput
        multiline
        numberOfLines={3}
        onChangeText={(value) => updateDraft("cancellationPolicy", value)}
        placeholder={t.seller.mealPackages.cancellationPolicyPlaceholder}
        style={[styles.input, styles.multiInputShort]}
        testID="meal-form-cancellation-policy-input"
        value={draft.cancellationPolicy}
      />

      <Text style={styles.label}>{t.seller.mealPackages.originalPrice}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={(value) => updateDraft("oldPrice", value)}
        style={styles.input}
        testID="meal-form-old-price-input"
        value={draft.oldPrice}
      />

      <Text style={styles.label}>{t.seller.mealPackages.customerPrice}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={(value) => updateDraft("newPrice", value)}
        style={styles.input}
        testID="meal-form-new-price-input"
        value={draft.newPrice}
      />

      <Text style={styles.label}>{t.seller.mealPackages.portionsAvailable}</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={(value) => updateDraft("quantity", value)}
        style={styles.input}
        testID="meal-form-quantity-input"
        value={draft.quantity}
      />

      <Text style={styles.label}>{t.seller.mealPackages.pickupStarts}</Text>
      <TextInput
        onChangeText={(value) => updateDraft("pickupStart", value)}
        style={styles.input}
        testID="meal-form-pickup-start-input"
        value={draft.pickupStart}
      />

      <Text style={styles.label}>{t.seller.mealPackages.pickupEnds}</Text>
      <TextInput
        onChangeText={(value) => updateDraft("pickupEnd", value)}
        style={styles.input}
        testID="meal-form-pickup-end-input"
        value={draft.pickupEnd}
      />

      <Pressable
        accessibilityLabel={t.seller.mealPackages.publishButton}
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={() => void onSubmit(draft)}
        style={[styles.submitButton, isSubmitting ? styles.disabledButton : null]}
        testID="meal-form-submit-button"
      >
        <Text style={styles.submitText}>
          {isSubmitting
            ? t.seller.mealPackages.publishing
            : t.seller.mealPackages.publishButton}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#16C79A",
  },
  chipText: {
    color: "#111827",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  chips: {
    flexDirection: "row",
    marginBottom: 8,
  },
  container: {
    gap: 10,
    paddingBottom: 32,
  },
  disabledButton: {
    opacity: 0.6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    color: "#6B7280",
    fontSize: 12,
  },
  multiInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  multiInputShort: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 14,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
