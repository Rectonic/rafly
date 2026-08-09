import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/seller/auth-store";

export default function SignupScreen() {
  const router = useRouter();
  const t = useT();
  const { error, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const closeAuth = () => {
    router.replace("/(tabs)");
  };

  const handleSubmit = async () => {
    try {
      await signUp(email.trim(), password);
      router.replace("/auth/business-type");
    } catch (signUpError) {
      Alert.alert(
        t.auth.signUpFailedTitle,
        signUpError instanceof Error
          ? signUpError.message
          : error ?? t.auth.signUpFailedFallback
      );
    }
  };

  return (
    <ScreenScrollView
      bottomInsetPadding={24}
      contentContainerStyle={styles.container}
      testID="seller-signup-screen"
      topInsetPadding={24}
    >
      <Pressable
        accessibilityLabel={t.auth.closeSellerOnboarding}
        accessibilityRole="button"
        onPress={closeAuth}
        style={styles.closeButton}
        testID="seller-signup-close-button"
      >
        <Ionicons color="#111827" name="close" size={24} />
      </Pressable>
      <Text style={styles.title}>{t.auth.signUpTitle}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder={t.auth.emailPlaceholder}
        style={styles.input}
        testID="seller-signup-email-input"
        value={email}
      />
      <TextInput
        onChangeText={setPassword}
        placeholder={t.auth.passwordPlaceholder}
        secureTextEntry
        style={styles.input}
        testID="seller-signup-password-input"
        value={password}
      />
      <Pressable
        accessibilityLabel={t.auth.continue}
        accessibilityRole="button"
        onPress={() => void handleSubmit()}
        style={styles.button}
        testID="seller-signup-submit-button"
      >
        <Text style={styles.buttonText}>{t.auth.continue}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    gap: 14,
    minHeight: "100%",
    justifyContent: "center",
    padding: 24,
  },
  error: {
    color: "#DC2626",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});
