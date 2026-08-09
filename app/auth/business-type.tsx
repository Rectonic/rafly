import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/seller/auth-store";

export default function BusinessTypeScreen() {
  const router = useRouter();
  const t = useT();
  const { completeBusinessTypeSelection } = useAuth();

  const chooseType = async (businessType: "restaurant" | "shop") => {
    try {
      await completeBusinessTypeSelection(businessType);
      router.replace("/(seller-tabs)");
    } catch (onboardingError) {
      Alert.alert(
        t.auth.onboardingFailedTitle,
        onboardingError instanceof Error
          ? onboardingError.message
          : t.auth.onboardingFailedFallback
      );
    }
  };

  const closeOnboarding = () => {
    router.replace("/(tabs)/settings");
  };

  return (
    <ScreenScrollView
      bottomInsetPadding={24}
      contentContainerStyle={styles.container}
      testID="seller-business-type-screen"
      topInsetPadding={24}
    >
      <Pressable
        accessibilityLabel={t.auth.closeSellerOnboarding}
        accessibilityRole="button"
        onPress={closeOnboarding}
        style={styles.closeButton}
        testID="business-type-close-button"
      >
        <Ionicons color="#111827" name="close" size={24} />
      </Pressable>
      <Text style={styles.title}>{t.auth.businessType}</Text>
      <Pressable
        accessibilityLabel={t.auth.restaurantLabel}
        accessibilityRole="button"
        onPress={() => void chooseType("restaurant")}
        style={styles.button}
        testID="business-type-restaurant-button"
      >
        <Text style={styles.buttonText}>{t.auth.restaurantLabel}</Text>
        <Text style={styles.buttonSubtext}>{t.auth.restaurantSubtitle}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t.auth.shopLabel}
        accessibilityRole="button"
        onPress={() => void chooseType("shop")}
        style={styles.secondaryButton}
        testID="business-type-shop-button"
      >
        <Text style={styles.secondaryButtonText}>{t.auth.shopLabel}</Text>
        <Text style={styles.secondarySubtext}>{t.auth.shopSubtitle}</Text>
      </Pressable>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    gap: 6,
    minHeight: 76,
    paddingVertical: 14,
  },
  buttonSubtext: {
    color: "#ECFDF5",
    fontSize: 13,
    textAlign: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    top: 20,
    width: 40,
    zIndex: 1,
  },
  container: {
    backgroundColor: "#F8F9FA",
    gap: 16,
    minHeight: "100%",
    justifyContent: "center",
    padding: 24,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    minHeight: 76,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "700",
  },
  secondarySubtext: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});
