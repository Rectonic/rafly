import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { InventoryCard } from "@/components/seller/InventoryCard";
import { Scanner } from "@/components/seller/Scanner";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/seller/auth-store";
import { useInventory } from "@/lib/seller/inventory-store";
import type { ExpiryResult } from "@/lib/seller/expiry-parser";

export default function InventoryScreen() {
  const { sellerProfile } = useAuth();
  const { addItem, deleteItem, error, isLoading, items, loadItems } =
    useInventory();
  const t = useT();
  const [productName, setProductName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [scannerMode, setScannerMode] = useState<"barcode" | "ocr" | null>(null);

  const submit = async () => {
    const parsedQuantity = Number.parseInt(quantity, 10);

    if (
      productName.trim().length === 0 ||
      expiryDate.trim().length === 0 ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      Alert.alert(
        t.seller.stockIntake.invalidItemTitle,
        t.seller.stockIntake.invalidItemMessage
      );
      return;
    }

    try {
      await addItem({
        barcode: barcode.trim(),
        expiryDate: expiryDate.trim(),
        productName: productName.trim(),
        quantity: parsedQuantity,
        source: "manual",
      });

      setProductName("");
      setBarcode("");
      setExpiryDate("");
      setQuantity("1");
      Alert.alert(t.seller.stockIntake.savedTitle, t.seller.stockIntake.itemAdded);
    } catch (saveError) {
      Alert.alert(
        t.seller.stockIntake.saveFailedTitle,
        saveError instanceof Error
          ? saveError.message
          : t.seller.stockIntake.saveFailedFallback
      );
    }
  };

  if (sellerProfile?.businessType === "restaurant") {
    return (
      <ScreenScrollView
        contentContainerStyle={styles.container}
        testID="inventory-unavailable-screen"
      >
        <Text style={styles.title} testID="inventory-unavailable-message">
          {t.seller.stockIntake.unavailableForRestaurants}
        </Text>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.container} testID="inventory-screen">
      <Text style={styles.title}>{t.seller.stockIntake.title}</Text>
      <Pressable
        accessibilityLabel={t.seller.stockIntake.scanLive}
        accessibilityRole="button"
        onPress={() => setScannerMode("barcode")}
        style={styles.button}
        testID="inventory-scan-barcode-button"
      >
        <Text style={styles.buttonText}>{t.seller.stockIntake.scanLive}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t.seller.stockIntake.readExpiryLabel}
        accessibilityRole="button"
        onPress={() => setScannerMode("ocr")}
        style={styles.secondaryButton}
        testID="inventory-read-expiry-button"
      >
        <Text style={styles.secondaryButtonText}>
          {t.seller.stockIntake.readExpiryLabel}
        </Text>
      </Pressable>

      <TextInput
        accessibilityLabel={t.seller.stockIntake.productName}
        onChangeText={setProductName}
        placeholder={t.seller.stockIntake.productName}
        style={styles.input}
        testID="inventory-product-name-input"
        value={productName}
      />
      <TextInput
        accessibilityLabel={t.seller.stockIntake.barcode}
        onChangeText={setBarcode}
        placeholder={t.seller.stockIntake.barcode}
        style={styles.input}
        testID="inventory-barcode-input"
        value={barcode}
      />
      <TextInput
        accessibilityLabel={t.seller.stockIntake.expiryDate}
        onChangeText={setExpiryDate}
        placeholder="YYYY-MM-DD"
        style={styles.input}
        testID="inventory-expiry-date-input"
        value={expiryDate}
      />
      <TextInput
        accessibilityLabel={t.seller.stockIntake.quantity}
        keyboardType="number-pad"
        onChangeText={setQuantity}
        placeholder={t.seller.stockIntake.quantity}
        style={styles.input}
        testID="inventory-quantity-input"
        value={quantity}
      />
      <Pressable
        accessibilityLabel={t.seller.stockIntake.addItem}
        accessibilityRole="button"
        onPress={() => void submit()}
        style={styles.button}
        testID="inventory-add-item-button"
      >
        <Text style={styles.buttonText}>{t.seller.stockIntake.addItem}</Text>
      </Pressable>

      {isLoading ? (
        <View style={styles.loadingPanel} testID="inventory-loading-state">
          <Text style={styles.meta}>{t.seller.stockIntake.loadingItems}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorPanel} testID="inventory-error-state">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityLabel={t.seller.stockIntake.retryItems}
            accessibilityRole="button"
            onPress={() => void loadItems()}
            style={styles.errorRetryButton}
            testID="inventory-retry-button"
          >
            <Text style={styles.errorRetryText}>
              {t.seller.stockIntake.retryItems}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {items.map((item) => (
        <InventoryCard
          item={item}
          key={item.id}
          onDelete={() => void deleteItem(item.id)}
        />
      ))}

      {!isLoading && !error && items.length === 0 ? (
        <Text style={styles.meta} testID="inventory-empty-state">
          {t.seller.stockIntake.emptyItems}
        </Text>
      ) : null}

      <Scanner
        mode={scannerMode ?? "barcode"}
        onClose={() => setScannerMode(null)}
        onScan={(value) => {
          if (typeof value === "string") {
            setBarcode(value);
          } else {
            const result = value as ExpiryResult;
            if (result.date) {
              setExpiryDate(result.date);
            }
          }
        }}
        visible={scannerMode !== null}
      />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginBottom: 10,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
  loadingPanel: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  meta: {
    color: "#6B7280",
    marginBottom: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
});
