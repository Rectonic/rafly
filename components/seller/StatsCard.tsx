import { StyleSheet, Text, View } from "react-native";

type StatsCardProps = {
  title: string;
  value: string;
};

export function StatsCard({ title, value }: StatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    padding: 16,
  },
  title: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 6,
  },
  value: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "700",
  },
});
