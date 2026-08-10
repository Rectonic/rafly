import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ShopSellerBetaEntryV2 } from "@/components/seller/ShopSellerBetaEntryV2";
import { StatsCard } from "@/components/seller/StatsCard";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/seller/auth-store";
import { useInventory } from "@/lib/seller/inventory-store";
import { useOrders } from "@/lib/seller/orders-store";
import { useSellerOffers } from "@/lib/seller/offers-store";
import type { SellerBusinessType } from "@/types/seller";

type SetupStep = {
  actionLabel: string;
  complete: boolean;
  description: string;
  id: "profile" | "offer" | "inventory" | "pickup";
  route: "/(seller-tabs)/profile" | "/(seller-tabs)/create" | "/(seller-tabs)/inventory" | "/(seller-tabs)/orders";
  title: string;
};

export default function SellerDashboardScreen() {
  const router = useRouter();
  const { sellerProfile } = useAuth();
  const { items } = useInventory();
  const { offers } = useSellerOffers();
  const { orders } = useOrders();
  const t = useT();

  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const isRestaurant = sellerProfile?.businessType === "restaurant";
  const primaryActionLabel = isRestaurant
    ? t.seller.dashboard.createOffer
    : t.seller.dashboard.addItem;
  const businessTypeLabel =
    sellerProfile?.businessType === "restaurant"
      ? t.seller.dashboard.restaurantType
      : sellerProfile?.businessType === "shop"
        ? t.seller.dashboard.shopType
        : t.seller.dashboard.sellerFallback;
  const profileComplete = Boolean(
    sellerProfile?.businessName &&
      sellerProfile.category &&
      sellerProfile.address &&
      Number.isFinite(sellerProfile.latitude) &&
      Number.isFinite(sellerProfile.longitude)
  );
  const setupSteps = buildSetupSteps({
    businessType: sellerProfile?.businessType,
    hasCollectedOrder: orders.some((order) => order.status === "collected"),
    hasInventory: items.length > 0,
    hasOffer: offers.length > 0,
    profileComplete,
    t,
  });

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="seller-dashboard-screen"
    >
      <Text style={styles.title}>
        {sellerProfile?.businessName ?? t.seller.dashboard.sellerFallback}
      </Text>
      <Text style={styles.meta}>{businessTypeLabel}</Text>
      <View style={styles.grid}>
        <StatsCard title={t.seller.dashboard.activeOffers} value={String(offers.length)} />
        <StatsCard title={t.seller.dashboard.pendingPickups} value={String(pendingOrders)} />
        <StatsCard title={t.seller.dashboard.trackedInventory} value={String(items.length)} />
      </View>
      <View style={styles.checklist} testID="seller-setup-checklist">
        <Text style={styles.checklistTitle}>{t.seller.dashboard.setupTitle}</Text>
        <Text style={styles.checklistSubtitle}>
          {t.seller.dashboard.setupSubtitle}
        </Text>
        {setupSteps.map((step) => (
          <View
            key={step.id}
            style={styles.checklistStep}
            testID={`seller-setup-step-${step.id}`}
          >
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
            {step.complete ? (
              <Text style={styles.stepComplete}>
                {t.seller.dashboard.setupComplete}
              </Text>
            ) : (
              <Pressable
                accessibilityLabel={step.actionLabel}
                accessibilityRole="button"
                onPress={() => router.push(step.route)}
                style={styles.stepAction}
                testID={`seller-setup-action-${step.id}`}
              >
                <Text style={styles.stepActionText}>{step.actionLabel}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <ShopSellerBetaEntryV2 />
      <Pressable
        accessibilityLabel={primaryActionLabel}
        accessibilityRole="button"
        onPress={() =>
          router.push(
            sellerProfile?.businessType === "restaurant"
              ? "/(seller-tabs)/create"
              : "/(seller-tabs)/inventory"
          )
        }
        style={styles.button}
        testID="seller-dashboard-primary-action"
      >
        <Text style={styles.buttonText}>{primaryActionLabel}</Text>
      </Pressable>
    </ScreenScrollView>
  );
}

function buildSetupSteps({
  businessType,
  hasCollectedOrder,
  hasInventory,
  hasOffer,
  profileComplete,
  t,
}: {
  businessType?: SellerBusinessType;
  hasCollectedOrder: boolean;
  hasInventory: boolean;
  hasOffer: boolean;
  profileComplete: boolean;
  t: ReturnType<typeof useT>;
}): SetupStep[] {
  const isRestaurant = businessType !== "shop";
  const firstListingStep: SetupStep = isRestaurant
    ? {
        actionLabel: t.seller.dashboard.setupOpenCreate,
        complete: hasOffer,
        description: t.seller.dashboard.setupOfferDesc,
        id: "offer",
        route: "/(seller-tabs)/create",
        title: t.seller.dashboard.setupOfferTitle,
      }
    : {
        actionLabel: t.seller.dashboard.setupOpenInventory,
        complete: hasInventory,
        description: t.seller.dashboard.setupInventoryDesc,
        id: "inventory",
        route: "/(seller-tabs)/inventory",
        title: t.seller.dashboard.setupInventoryTitle,
      };

  return [
    {
      actionLabel: t.seller.dashboard.setupOpenProfile,
      complete: profileComplete,
      description: t.seller.dashboard.setupProfileDesc,
      id: "profile",
      route: "/(seller-tabs)/profile",
      title: t.seller.dashboard.setupProfileTitle,
    },
    firstListingStep,
    {
      actionLabel: t.seller.dashboard.setupOpenOrders,
      complete: hasCollectedOrder,
      description: t.seller.dashboard.setupPickupDesc,
      id: "pickup",
      route: "/(seller-tabs)/orders",
      title: t.seller.dashboard.setupPickupTitle,
    },
  ];
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginTop: 20,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  checklist: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 14,
  },
  checklistStep: {
    alignItems: "center",
    borderTopColor: "#E5E7EB",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  checklistSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  checklistTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  meta: {
    color: "#6B7280",
    marginTop: 6,
    textTransform: "capitalize",
  },
  stepAction: {
    borderColor: "#16C79A",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepActionText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  stepComplete: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "800",
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepDescription: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
  },
  stepTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});
