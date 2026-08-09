import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useLocale, useSetLocale } from "@/lib/locale-store";
import { useAuth } from "@/lib/seller/auth-store";
import { useSellerProfile } from "@/lib/seller/profile-store";
import type { LocalizedSellerProfileContent } from "@/types/seller";

type TranslationFormFields = {
  address: string;
  businessName: string;
  category: string;
};

type ProfileFormState = {
  address: string;
  businessName: string;
  businessType: string;
  category: string;
  latitude: string;
  longitude: string;
  translations: {
    en: TranslationFormFields;
    ru: TranslationFormFields;
  };
};

const EMPTY_TRANSLATION_FIELDS: TranslationFormFields = {
  address: "",
  businessName: "",
  category: "",
};

const DEFAULT_FORM: ProfileFormState = {
  address: "",
  businessName: "",
  businessType: "restaurant",
  category: "",
  latitude: "",
  longitude: "",
  translations: {
    en: EMPTY_TRANSLATION_FIELDS,
    ru: EMPTY_TRANSLATION_FIELDS,
  },
};

function buildProfileTranslations(
  translations: ProfileFormState["translations"]
): LocalizedSellerProfileContent | undefined {
  const normalized: LocalizedSellerProfileContent = {};

  (["en", "ru"] as const).forEach((locale) => {
    const address = translations[locale].address.trim();
    const businessName = translations[locale].businessName.trim();
    const category = translations[locale].category.trim();

    if (!address && !businessName && !category) {
      return;
    }

    normalized[locale] = {
      address: address || undefined,
      businessName: businessName || undefined,
      category: category || undefined,
    };
  });

  return Object.keys(normalized).length ? normalized : undefined;
}

export default function SellerProfileScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { sellerProfile, signOut } = useAuth();
  const { updateProfile } = useSellerProfile();
  const [form, setForm] = useState<ProfileFormState>(DEFAULT_FORM);

  useEffect(() => {
    if (!sellerProfile) {
      return;
    }

    setForm({
      address: sellerProfile.address,
      businessName: sellerProfile.businessName,
      businessType: sellerProfile.businessType,
      category: sellerProfile.category,
      latitude: String(sellerProfile.latitude),
      longitude: String(sellerProfile.longitude),
      translations: {
        en: {
          address: sellerProfile.translations?.en?.address ?? "",
          businessName: sellerProfile.translations?.en?.businessName ?? "",
          category: sellerProfile.translations?.en?.category ?? "",
        },
        ru: {
          address: sellerProfile.translations?.ru?.address ?? "",
          businessName: sellerProfile.translations?.ru?.businessName ?? "",
          category: sellerProfile.translations?.ru?.category ?? "",
        },
      },
    });
  }, [sellerProfile]);

  const updateTranslation = (
    locale: "en" | "ru",
    key: keyof TranslationFormFields,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: {
          ...current.translations[locale],
          [key]: value,
        },
      },
    }));
  };

  const saveProfile = async () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const businessType =
      form.businessType === "restaurant" || form.businessType === "shop"
        ? form.businessType
        : null;

    if (
      form.address.trim().length === 0 ||
      form.businessName.trim().length === 0 ||
      form.category.trim().length === 0 ||
      !businessType ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        t.seller.settings.saveFailedTitle,
        t.seller.settings.profileValidationError
      );
      return;
    }

    try {
      await updateProfile({
        address: form.address.trim(),
        businessName: form.businessName.trim(),
        businessType,
        category: form.category.trim(),
        latitude,
        longitude,
        translations: buildProfileTranslations(form.translations),
      });
      Alert.alert(t.seller.settings.savedTitle, t.seller.settings.profileSaved);
    } catch (saveError) {
      Alert.alert(
        t.seller.settings.saveFailedTitle,
        saveError instanceof Error
          ? saveError.message
          : t.seller.settings.saveFailedFallback
      );
    }
  };

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="seller-profile-screen"
    >
      <Text style={styles.title}>{t.seller.settings.profileTitle}</Text>
      <TextInput
        onChangeText={(businessName) => setForm((current) => ({ ...current, businessName }))}
        placeholder={t.seller.settings.businessName}
        style={styles.input}
        testID="seller-profile-business-name-input"
        value={form.businessName}
      />
      <TextInput
        onChangeText={(category) => setForm((current) => ({ ...current, category }))}
        placeholder={t.seller.settings.category}
        style={styles.input}
        testID="seller-profile-category-input"
        value={form.category}
      />
      <TextInput
        onChangeText={(address) => setForm((current) => ({ ...current, address }))}
        placeholder={t.seller.settings.address}
        style={styles.input}
        testID="seller-profile-address-input"
        value={form.address}
      />
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={(latitude) => setForm((current) => ({ ...current, latitude }))}
        placeholder={t.seller.settings.latitude}
        style={styles.input}
        testID="seller-profile-latitude-input"
        value={form.latitude}
      />
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={(longitude) => setForm((current) => ({ ...current, longitude }))}
        placeholder={t.seller.settings.longitude}
        style={styles.input}
        testID="seller-profile-longitude-input"
        value={form.longitude}
      />
      <Text style={styles.sectionTitle}>
        {t.seller.settings.translationsTitle}
      </Text>
      <TextInput
        onChangeText={(businessName) =>
          updateTranslation("en", "businessName", businessName)
        }
        placeholder={t.seller.settings.businessNameEn}
        style={styles.input}
        testID="seller-profile-business-name-en-input"
        value={form.translations.en.businessName}
      />
      <TextInput
        onChangeText={(businessName) =>
          updateTranslation("ru", "businessName", businessName)
        }
        placeholder={t.seller.settings.businessNameRu}
        style={styles.input}
        testID="seller-profile-business-name-ru-input"
        value={form.translations.ru.businessName}
      />
      <TextInput
        onChangeText={(category) => updateTranslation("en", "category", category)}
        placeholder={t.seller.settings.categoryEn}
        style={styles.input}
        testID="seller-profile-category-en-input"
        value={form.translations.en.category}
      />
      <TextInput
        onChangeText={(category) => updateTranslation("ru", "category", category)}
        placeholder={t.seller.settings.categoryRu}
        style={styles.input}
        testID="seller-profile-category-ru-input"
        value={form.translations.ru.category}
      />
      <TextInput
        multiline
        onChangeText={(address) => updateTranslation("en", "address", address)}
        placeholder={t.seller.settings.addressEn}
        style={[styles.input, styles.multilineInput]}
        testID="seller-profile-address-en-input"
        value={form.translations.en.address}
      />
      <TextInput
        multiline
        onChangeText={(address) => updateTranslation("ru", "address", address)}
        placeholder={t.seller.settings.addressRu}
        style={[styles.input, styles.multilineInput]}
        testID="seller-profile-address-ru-input"
        value={form.translations.ru.address}
      />
      <Pressable
        accessibilityLabel={t.seller.settings.saveProfileButton}
        accessibilityRole="button"
        onPress={() => void saveProfile()}
        style={styles.button}
        testID="seller-profile-save-button"
      >
        <Text style={styles.buttonText}>{t.seller.settings.saveProfileButton}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{t.seller.settings.language}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t.seller.settings.switchLanguageRu}
          accessibilityRole="button"
          onPress={() => void setLocale("ru")}
          style={[styles.chip, locale === "ru" ? styles.chipActive : null]}
          testID="seller-profile-language-ru"
        >
          <Text style={[styles.chipText, locale === "ru" ? styles.chipTextActive : null]}>
            RU
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.seller.settings.switchLanguageEn}
          accessibilityRole="button"
          onPress={() => void setLocale("en")}
          style={[styles.chip, locale === "en" ? styles.chipActive : null]}
          testID="seller-profile-language-en"
        >
          <Text style={[styles.chipText, locale === "en" ? styles.chipTextActive : null]}>
            EN
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel={t.seller.settings.switchToBuyer}
        accessibilityRole="button"
        onPress={() => router.replace("/(tabs)")}
        style={styles.secondaryButton}
        testID="seller-profile-switch-buyer-button"
      >
        <Text style={styles.secondaryText}>{t.seller.settings.switchToBuyer}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t.seller.settings.signOut}
        accessibilityRole="button"
        onPress={() => void signOut().then(() => router.replace("/(tabs)"))}
        style={styles.secondaryButton}
        testID="seller-profile-sign-out-button"
      >
        <Text style={styles.secondaryText}>{t.seller.settings.signOut}</Text>
      </Pressable>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: "#16C79A",
  },
  chipText: {
    color: "#111827",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    marginTop: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 14,
  },
  secondaryText: {
    color: "#111827",
    fontWeight: "600",
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
