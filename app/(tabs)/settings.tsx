import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useLocale, useSetLocale } from "@/lib/locale-store";
import { useAuth } from "@/lib/seller/auth-store";

export default function SettingsScreen() {
  const router = useRouter();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { sellerProfile, session } = useAuth();
  const t = useT();

  const sellerModeLabel =
    session && sellerProfile ? t.settings.switchToSeller : t.settings.sellerMode;

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="settings-screen"
    >
      <Text style={styles.title}>{t.settings.title}</Text>
      <Text style={styles.sectionTitle}>{t.settings.language}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t.settings.switchLanguageRu}
          accessibilityRole="button"
          onPress={() => void setLocale("ru")}
          style={[styles.chip, locale === "ru" ? styles.activeChip : null]}
          testID="settings-language-ru"
        >
          <Text style={[styles.chipText, locale === "ru" ? styles.activeChipText : null]}>
            RU
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.settings.switchLanguageEn}
          accessibilityRole="button"
          onPress={() => void setLocale("en")}
          style={[styles.chip, locale === "en" ? styles.activeChip : null]}
          testID="settings-language-en"
        >
          <Text style={[styles.chipText, locale === "en" ? styles.activeChipText : null]}>
            EN
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t.settings.seller}</Text>
      <Pressable
        accessibilityLabel={sellerModeLabel}
        accessibilityRole="button"
        onPress={() =>
          router.push(session && sellerProfile ? "/(seller-tabs)" : "/auth/login")
        }
        style={styles.button}
        testID="settings-seller-mode-button"
      >
        <Text style={styles.buttonText}>{sellerModeLabel}</Text>
      </Pressable>

      {!session ? (
        <Text style={styles.meta}>{t.settings.sellerAuthRequired}</Text>
      ) : null}

      <Pressable
        accessibilityLabel={t.settings.aboutBuild}
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(t.settings.aboutTitle, t.settings.aboutMessage)
        }
        style={styles.secondaryButton}
        testID="settings-about-button"
      >
        <Text style={styles.secondaryButtonText}>{t.settings.aboutBuild}</Text>
      </Pressable>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  activeChip: {
    backgroundColor: "#16C79A",
  },
  activeChipText: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#16C79A",
    borderRadius: 12,
    paddingHorizontal: 16,
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
  chipText: {
    color: "#111827",
    fontWeight: "600",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  meta: {
    color: "#6B7280",
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
    marginTop: 12,
  },
  secondaryButton: {
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
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
  },
});
