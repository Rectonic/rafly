import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { InventoryItem } from "@/types/seller";

type InventoryCardProps = {
  item: InventoryItem;
  onDelete: () => void;
};

export function InventoryCard({ item, onDelete }: InventoryCardProps) {
  const t = useT();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.productName}</Text>
          <Text style={styles.meta}>{item.expiryDate}</Text>
          <Text style={styles.meta}>
            {t.seller.stockIntake.quantityLabel(item.quantity)}
          </Text>
        </View>
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteText}>{t.seller.stockIntake.deleteItem}</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>
        {item.barcode
          ? t.seller.stockIntake.barcodeLabel(item.barcode)
          : t.seller.stockIntake.manualEntry}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginBottom: 12,
    padding: 16,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    color: "#DC2626",
    fontWeight: "600",
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
});
