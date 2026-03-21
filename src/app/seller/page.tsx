"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { motion } from "framer-motion";
import {
  Bell,
  Camera,
  CheckCircle2,
  Clock3,
  History,
  ImageIcon,
  LayoutDashboard,
  Leaf,
  Package,
  Plus,
  ScanLine,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Tesseract from "tesseract.js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addInventoryItem,
  publishSellerOffer,
  saveSellerProfile,
  useSellerWorkspace,
  verifyPickupOrder,
} from "@/lib/marketplace-store";
import {
  DEFAULT_SELLER_AVATAR,
  buildFallbackSellerProfile,
} from "@/lib/backend/default-seller-profile";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { OfferCategory } from "@/types/offer";
import type {
  MealPackageDraft,
  SellerBusinessType,
  SellerInventoryItem,
  SellerProfile,
} from "@/types/seller";

const CATEGORY_OPTIONS: OfferCategory[] = [
  "Meals",
  "Baked Goods",
  "Groceries",
  "Vegan",
  "Surprise Bags",
];

const DEFAULT_PACKAGE_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80";

const DEFAULT_PACKAGE_DRAFT: MealPackageDraft = {
  title: "",
  category: "Meals",
  oldPrice: "",
  newPrice: "",
  quantity: "5",
  pickupStart: "18:00",
  pickupEnd: "21:00",
  image: "",
  contentsText: "",
};

type InventoryDraft = {
  productName: string;
  barcode: string;
  expiryDate: string;
  quantity: string;
  source: SellerInventoryItem["source"];
  ocrText: string;
};

const DEFAULT_INVENTORY_DRAFT: InventoryDraft = {
  productName: "",
  barcode: "",
  expiryDate: "",
  quantity: "1",
  source: "manual",
  ocrText: "",
};

type ProfileDraft = {
  businessName: string;
  businessType: SellerBusinessType;
  category: string;
  address: string;
  latitude: string;
  longitude: string;
};

type SellerSectionId =
  | "dashboard"
  | "meal-packages"
  | "stock-intake"
  | "order-history"
  | "insights"
  | "settings";

const ALL_visibleSections: Array<{
  id: SellerSectionId;
  icon: LucideIcon;
  forType: "restaurant" | "shop" | "both";
}> = [
  { id: "dashboard",     icon: LayoutDashboard, forType: "both" },
  { id: "meal-packages", icon: UtensilsCrossed,  forType: "restaurant" },
  { id: "stock-intake",  icon: ScanLine,         forType: "shop" },
  { id: "order-history", icon: History,          forType: "both" },
  { id: "insights",      icon: TrendingUp,       forType: "both" },
  { id: "settings",      icon: Settings,         forType: "both" },
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function normalizeDate(day: string, month: string, year: string) {
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0"
  )}`;
}

function extractExpiryDate(text: string) {
  const cleaned = text.replace(/\s+/g, " ");

  const dayFirst = cleaned.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (dayFirst) {
    return normalizeDate(dayFirst[1], dayFirst[2], dayFirst[3]);
  }

  const yearFirst = cleaned.match(/\b(\d{4})[./-](\d{2})[./-](\d{2})\b/);
  if (yearFirst) {
    return `${yearFirst[1]}-${yearFirst[2]}-${yearFirst[3]}`;
  }

  return null;
}

function formatExpiryDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function parseContents(text: string) {
  return text
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toProfileDraft(profile: SellerProfile): ProfileDraft {
  return {
    businessName: profile.businessName,
    businessType: profile.businessType,
    category: profile.category,
    address: profile.address,
    latitude: profile.location.lat.toString(),
    longitude: profile.location.lng.toString(),
  };
}

function SellerDashboard() {
  const t = useT();

  function getSectionLabel(id: SellerSectionId): string {
    const map: Record<SellerSectionId, string> = {
      dashboard: t.seller.nav.dashboard,
      "meal-packages": t.seller.nav.mealPackages,
      "stock-intake": t.seller.nav.stockIntake,
      "order-history": t.seller.nav.orderHistory,
      insights: t.seller.nav.insights,
      settings: t.seller.nav.settings,
    };
    return map[id];
  }

  const { profile, inventory, pickupOrders, publishedOffers } =
    useSellerWorkspace();
  const sellerProfile = useMemo(
    () => profile ?? buildFallbackSellerProfile(),
    [profile]
  );
  const [activeSection, setActiveSection] =
    useState<SellerSectionId>("dashboard");
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() =>
    toProfileDraft(sellerProfile)
  );
  const [inventoryDraft, setInventoryDraft] =
    useState<InventoryDraft>(DEFAULT_INVENTORY_DRAFT);
  const [packageDraft, setPackageDraft] =
    useState<MealPackageDraft>(DEFAULT_PACKAGE_DRAFT);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isReadingExpiry, setIsReadingExpiry] = useState(false);
  const [pickupCode, setPickupCode] = useState("");
  const [pickupMessage, setPickupMessage] = useState<string | null>(null);
  const [isPickupScanning, setIsPickupScanning] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const businessType = sellerProfile.businessType;
  const visibleSections = ALL_visibleSections.filter(
    (s) => s.forType === "both" || s.forType === businessType
  );

  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeImageInputRef = useRef<HTMLInputElement | null>(null);
  const expiryImageInputRef = useRef<HTMLInputElement | null>(null);
  const pickupScannerControlsRef = useRef<IScannerControls | null>(null);
  const pickupVideoRef = useRef<HTMLVideoElement | null>(null);
  const pickupImageInputRef = useRef<HTMLInputElement | null>(null);

  const salesTotal = useMemo(
    () =>
      publishedOffers.reduce((sum, offer) => {
        const quantity = offer.quantityAvailable ?? 0;
        return sum + quantity * offer.newPrice;
      }, 0),
    [publishedOffers]
  );

  const inventoryExpiringSoon = useMemo(
    () =>
      inventory.filter((item) => {
        const diff =
          new Date(item.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
        return diff <= 3 * 24 * 60 * 60 * 1000;
      }).length,
    [inventory]
  );

  useEffect(() => {
    setProfileDraft(toProfileDraft(sellerProfile));
  }, [sellerProfile]);

  useEffect(() => {
    const previewNode = videoRef.current;
    const pickupPreviewNode = pickupVideoRef.current;

    return () => {
      scannerControlsRef.current?.stop();
      pickupScannerControlsRef.current?.stop();

      if (previewNode?.srcObject instanceof MediaStream) {
        previewNode.srcObject
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (pickupPreviewNode?.srcObject instanceof MediaStream) {
        pickupPreviewNode.srcObject
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    const sectionNodes = visibleSections.map((section) =>
      document.getElementById(section.id)
    ).filter(Boolean) as HTMLElement[];

    if (sectionNodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio)[0];

        if (visibleEntry) {
          setActiveSection(visibleEntry.target.id as SellerSectionId);
        }
      },
      {
        rootMargin: "-96px 0px -50% 0px",
        threshold: [0.2, 0.35, 0.6],
      }
    );

    sectionNodes.forEach((sectionNode) => observer.observe(sectionNode));

    return () => observer.disconnect();
  }, []);

  function getBarcodeReader() {
    if (!barcodeReaderRef.current) {
      barcodeReaderRef.current = new BrowserMultiFormatReader();
    }

    return barcodeReaderRef.current;
  }

  function stopCameraScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }

  function stopPickupScanner() {
    pickupScannerControlsRef.current?.stop();
    pickupScannerControlsRef.current = null;

    if (pickupVideoRef.current?.srcObject instanceof MediaStream) {
      pickupVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      pickupVideoRef.current.srcObject = null;
    }

    setIsPickupScanning(false);
  }

  async function startCameraScanner() {
    if (!videoRef.current) {
      return;
    }

    stopCameraScanner();
    setScanMessage(t.seller.stockIntake.scanOpeningCamera);

    try {
      const controls = await getBarcodeReader().decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, runningControls) => {
          if (result) {
            const code = result.getText();

            setInventoryDraft((current) => ({
              ...current,
              barcode: code,
              source: "camera",
            }));
            setScanMessage(t.seller.stockIntake.scanCamera(code));
            runningControls.stop();
            stopCameraScanner();
            return;
          }

          if (error && error.name !== "NotFoundException") {
            setScanMessage(t.seller.stockIntake.scanActive);
          }
        }
      );

      scannerControlsRef.current = controls;
      setIsScanning(true);
    } catch {
      setScanMessage(t.seller.stockIntake.scanCameraError);
    }
  }

  async function runPickupVerification(scannedCode: string) {
    const cleanedCode = scannedCode.trim();

    if (!cleanedCode) {
      return;
    }

    setPickupCode(cleanedCode);

    const matchedOrder = await verifyPickupOrder(cleanedCode);

    if (matchedOrder) {
      setPickupMessage(
        t.seller.orderHistory.pickupConfirmed(matchedOrder.customerName, matchedOrder.offerTitle)
      );
    } else {
      setPickupMessage(t.seller.orderHistory.pickupNotFound);
    }
  }

  async function startPickupScanner() {
    if (!pickupVideoRef.current) {
      return;
    }

    stopPickupScanner();
    setPickupMessage(t.seller.orderHistory.pickupScannerStart);

    try {
      const controls = await getBarcodeReader().decodeFromVideoDevice(
        undefined,
        pickupVideoRef.current,
        (result, error, runningControls) => {
          if (result) {
            void runPickupVerification(result.getText());
            runningControls.stop();
            stopPickupScanner();
            return;
          }

          if (error && error.name !== "NotFoundException") {
            setPickupMessage(t.seller.orderHistory.pickupScannerActive);
          }
        }
      );

      pickupScannerControlsRef.current = controls;
      setIsPickupScanning(true);
    } catch {
      setPickupMessage(t.seller.orderHistory.pickupScannerError);
    }
  }

  async function handlePickupImageScan(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const result = await getBarcodeReader().decodeFromImageUrl(objectUrl);
      void runPickupVerification(result.getText());
    } catch {
      setPickupMessage(t.seller.orderHistory.pickupImageError);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleBarcodeImageScan(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const result = await getBarcodeReader().decodeFromImageUrl(objectUrl);
      const code = result.getText();

      setInventoryDraft((current) => ({
        ...current,
        barcode: code,
        source: "image",
      }));
      setScanMessage(t.seller.stockIntake.scanImageResult(code));
    } catch {
      setScanMessage(t.seller.stockIntake.scanImageError);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleExpiryOcr(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsReadingExpiry(true);
    setOcrMessage(t.seller.stockIntake.ocrReading);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng");
      const detectedDate = extractExpiryDate(text);

      setInventoryDraft((current) => ({
        ...current,
        expiryDate: detectedDate ?? current.expiryDate,
        ocrText: text.trim(),
      }));

      if (detectedDate) {
        setOcrMessage(t.seller.stockIntake.ocrSuccess(formatExpiryDate(detectedDate)));
      } else {
        setOcrMessage(t.seller.stockIntake.ocrNoDate);
      }
    } catch {
      setOcrMessage(t.seller.stockIntake.ocrError);
    } finally {
      setIsReadingExpiry(false);
    }
  }

  function addTrackedInventory() {
    if (
      !inventoryDraft.productName.trim() ||
      !inventoryDraft.barcode.trim() ||
      !inventoryDraft.expiryDate
    ) {
      return;
    }

    startTransition(() => {
      void addInventoryItem({
        id: createId("inventory"),
        productName: inventoryDraft.productName.trim(),
        barcode: inventoryDraft.barcode.trim(),
        expiryDate: inventoryDraft.expiryDate,
        quantity: Number(inventoryDraft.quantity || "1"),
        source: inventoryDraft.source,
        ocrText: inventoryDraft.ocrText,
        createdAt: new Date().toISOString(),
      });
    });

    setInventoryDraft(DEFAULT_INVENTORY_DRAFT);
    setScanMessage(t.seller.stockIntake.itemAdded);
    setOcrMessage(null);
  }

  function publishMealPackage() {
    const oldPrice = Number(packageDraft.oldPrice);
    const newPrice = Number(packageDraft.newPrice);
    const quantity = Number(packageDraft.quantity);
    const contents = parseContents(packageDraft.contentsText);

    if (
      !packageDraft.title.trim() ||
      !Number.isFinite(oldPrice) ||
      !Number.isFinite(newPrice) ||
      !Number.isFinite(quantity) ||
      !packageDraft.pickupEnd ||
      contents.length === 0
    ) {
      return;
    }

    const discount = Math.max(
      0,
      Math.round(((oldPrice - newPrice) / Math.max(oldPrice, 1)) * 100)
    );

    startTransition(() => {
      void publishSellerOffer({
        id: createId("seller-offer"),
        title: packageDraft.title.trim(),
        restaurant: sellerProfile.businessName,
        image: packageDraft.image.trim() || DEFAULT_PACKAGE_IMAGE,
        oldPrice,
        newPrice,
        discount,
        distance: "0.3 km",
        endTime: packageDraft.pickupEnd,
        pickupStart: packageDraft.pickupStart,
        rating: sellerProfile.rating,
        reviews: sellerProfile.reviews,
        category: packageDraft.category,
        location: sellerProfile.location,
        quantityAvailable: quantity,
        contents,
        source: "seller",
        businessType: sellerProfile.businessType,
      });
    });

    setPackageDraft(DEFAULT_PACKAGE_DRAFT);
  }

  async function handleSaveProfile() {
    const latitude = Number(profileDraft.latitude);
    const longitude = Number(profileDraft.longitude);

    if (
      !profileDraft.businessName.trim() ||
      !profileDraft.category.trim() ||
      !profileDraft.address.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setProfileMessage(t.seller.settings.profileValidationError);
      return;
    }

    setIsSavingProfile(true);

    try {
      await saveSellerProfile({
        businessName: profileDraft.businessName.trim(),
        businessType: profileDraft.businessType,
        category: profileDraft.category.trim(),
        address: profileDraft.address.trim(),
        latitude,
        longitude,
      });
      setProfileMessage(t.seller.settings.profileSaved);
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : t.seller.settings.profileError
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  function navigateToSection(sectionId: SellerSectionId) {
    setActiveSection(sectionId);

    if (typeof window === "undefined") {
      return;
    }

    const sectionNode = document.getElementById(sectionId);

    if (!sectionNode) {
      return;
    }

    const top = sectionNode.getBoundingClientRect().top + window.scrollY - 88;

    window.scrollTo({
      top,
      behavior: "smooth",
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full">
      <aside className="hidden h-[calc(100vh-64px)] w-64 flex-col border-r bg-card lg:sticky lg:top-16 lg:flex">
        <div className="p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border">
              <img
                src={DEFAULT_SELLER_AVATAR}
                alt={sellerProfile.businessName}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">
                {sellerProfile.businessName}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sellerProfile.category}
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {visibleSections.map((section) => {
              const Icon = section.icon;

              return (
              <NavItem
                key={section.id}
                icon={<Icon className="h-4 w-4" />}
                label={getSectionLabel(section.id)}
                active={activeSection === section.id}
                onClick={() => navigateToSection(section.id)}
              />
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 bg-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:hidden">
            <div className="flex min-w-max items-center gap-2">
              {visibleSections.map((section) => {
                const Icon = section.icon;

                return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigateToSection(section.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    activeSection === section.id
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {getSectionLabel(section.id)}
                </button>
                );
              })}
            </div>
          </div>

          <section id="dashboard" className="scroll-mt-24 space-y-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {businessType === "restaurant" ? t.seller.dashboard.badgeRestaurant : t.seller.dashboard.badgeShop}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {businessType === "restaurant"
                    ? t.seller.dashboard.titleRestaurant
                    : t.seller.dashboard.titleShop}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {businessType === "restaurant"
                    ? t.seller.dashboard.subtitleRestaurant
                    : t.seller.dashboard.subtitleShop}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigateToSection("settings")}
                  aria-label={t.seller.dashboard.openSettings}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/">
                    <Plus className="mr-2 h-4 w-4" />
                    {t.seller.dashboard.viewMarketplace}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title={t.seller.metrics.salesTitle}
                value={`$${salesTotal.toFixed(2)}`}
                description={t.seller.metrics.salesDesc(publishedOffers.length)}
                icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                delay={0.05}
              />
              <MetricCard
                title={t.seller.metrics.inventoryTitle}
                value={`${inventory.length}`}
                description={t.seller.metrics.inventoryDesc(inventoryExpiringSoon)}
                icon={<Package className="h-4 w-4 text-primary" />}
                delay={0.1}
              />
              <MetricCard
                title={t.seller.metrics.packagesTitle}
                value={`${publishedOffers.reduce(
                  (sum, offer) => sum + (offer.quantityAvailable ?? 0),
                  0
                )}`}
                description={t.seller.metrics.packagesDesc}
                icon={<UtensilsCrossed className="h-4 w-4 text-secondary" />}
                delay={0.15}
              />
              <MetricCard
                title={t.seller.metrics.foodSavedTitle}
                value={`${(inventory.length * 1.7 + publishedOffers.length * 2.4).toFixed(1)} kg`}
                description={t.seller.metrics.foodSavedDesc}
                icon={<Leaf className="h-4 w-4 text-emerald-600" />}
                delay={0.2}
              />
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
            {businessType === "shop" && <section id="stock-intake" className="scroll-mt-24">
            <Card className="overflow-hidden border-none shadow-sm">
              <CardHeader className="border-b bg-card/70">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ScanLine className="h-5 w-5 text-primary" />
                  {t.seller.stockIntake.cardTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.stockIntake.productName}
                    <Input
                      value={inventoryDraft.productName}
                      onChange={(event) =>
                        setInventoryDraft((current) => ({
                          ...current,
                          productName: event.target.value,
                        }))
                      }
                      placeholder={t.seller.stockIntake.productNamePlaceholder}
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.stockIntake.quantity}
                    <Input
                      type="number"
                      min="1"
                      value={inventoryDraft.quantity}
                      onChange={(event) =>
                        setInventoryDraft((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => void startCameraScanner()}>
                      <Camera className="mr-2 h-4 w-4" />
                      {t.seller.stockIntake.scanLive}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => barcodeImageInputRef.current?.click()}
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {t.seller.stockIntake.decodeBarcodeImage}
                    </Button>
                    {isScanning && (
                      <Button type="button" variant="ghost" onClick={stopCameraScanner}>
                        {t.seller.stockIntake.stopCamera}
                      </Button>
                    )}
                  </div>

                  <input
                    ref={barcodeImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBarcodeImageScan}
                  />

                  <div className="mt-4 overflow-hidden rounded-2xl border bg-black">
                    <video
                      ref={videoRef}
                      className={cn(
                        "h-56 w-full object-cover",
                        !isScanning && "hidden"
                      )}
                      muted
                      playsInline
                    />
                    {!isScanning && (
                      <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-white/70">
                        {t.seller.stockIntake.cameraPreview}
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">{scanMessage ?? t.seller.stockIntake.scanInitial}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.stockIntake.barcode}
                    <Input
                      value={inventoryDraft.barcode}
                      onChange={(event) =>
                        setInventoryDraft((current) => ({
                          ...current,
                          barcode: event.target.value,
                          source: "manual",
                        }))
                      }
                      placeholder={t.seller.stockIntake.barcodePlaceholder}
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.stockIntake.expiryDate}
                    <Input
                      type="date"
                      value={inventoryDraft.expiryDate}
                      onChange={(event) =>
                        setInventoryDraft((current) => ({
                          ...current,
                          expiryDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => expiryImageInputRef.current?.click()}
                      disabled={isReadingExpiry}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isReadingExpiry ? t.seller.stockIntake.readingExpiry : t.seller.stockIntake.ocrFromImage}
                    </Button>
                    <input
                      ref={expiryImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleExpiryOcr}
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{ocrMessage ?? t.seller.stockIntake.ocrInitial}</p>
                  {inventoryDraft.ocrText && (
                    <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="mb-1 font-semibold text-foreground">
                        {t.seller.stockIntake.ocrSnapshot}
                      </p>
                      <p className="line-clamp-4 whitespace-pre-wrap">
                        {inventoryDraft.ocrText}
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={addTrackedInventory}
                  disabled={
                    !inventoryDraft.productName.trim() ||
                    !inventoryDraft.barcode.trim() ||
                    !inventoryDraft.expiryDate
                  }
                >
                  {t.seller.stockIntake.addToStock}
                </Button>
              </CardContent>
            </Card>
            </section>}

            {businessType === "restaurant" && <section id="meal-packages" className="scroll-mt-24">
            <Card className="overflow-hidden border-none shadow-sm">
              <CardHeader className="border-b bg-card/70">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UtensilsCrossed className="h-5 w-5 text-secondary" />
                  {t.seller.mealPackages.cardTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <label className="space-y-2 text-sm font-medium">
                  {t.seller.mealPackages.packageTitle}
                  <Input
                    value={packageDraft.title}
                    onChange={(event) =>
                      setPackageDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder={t.seller.mealPackages.packageTitlePlaceholder}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.category}
                    <select
                      value={packageDraft.category}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          category: event.target.value as OfferCategory,
                        }))
                      }
                      className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
                    >
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.imageUrl}
                    <Input
                      value={packageDraft.image}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          image: event.target.value,
                        }))
                      }
                      placeholder={t.seller.mealPackages.imageUrlPlaceholder}
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm font-medium">
                  {t.seller.mealPackages.contents}
                  <textarea
                    value={packageDraft.contentsText}
                    onChange={(event) =>
                      setPackageDraft((current) => ({
                        ...current,
                        contentsText: event.target.value,
                      }))
                    }
                    placeholder={t.seller.mealPackages.contentsPlaceholder}
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.originalPrice}
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={packageDraft.oldPrice}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          oldPrice: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.customerPrice}
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={packageDraft.newPrice}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          newPrice: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.portionsAvailable}
                    <Input
                      type="number"
                      min="1"
                      value={packageDraft.quantity}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.pickupStarts}
                    <Input
                      type="time"
                      value={packageDraft.pickupStart}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          pickupStart: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    {t.seller.mealPackages.pickupEnds}
                    <Input
                      type="time"
                      value={packageDraft.pickupEnd}
                      onChange={(event) =>
                        setPackageDraft((current) => ({
                          ...current,
                          pickupEnd: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold text-foreground">
                    {t.seller.mealPackages.visibilityTitle}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t.seller.mealPackages.visibilityDesc}
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  onClick={publishMealPackage}
                  disabled={
                    !packageDraft.title.trim() ||
                    !packageDraft.contentsText.trim() ||
                    !packageDraft.oldPrice ||
                    !packageDraft.newPrice
                  }
                >
                  {t.seller.mealPackages.publishButton}
                </Button>
              </CardContent>
            </Card>
            </section>}
          </div>

          <section id="order-history" className="scroll-mt-24">
            <div className="grid items-start gap-6 xl:grid-cols-2">
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b bg-card/70">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {t.seller.orderHistory.pickupTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => void startPickupScanner()}>
                    <Camera className="mr-2 h-4 w-4" />
                    {t.seller.orderHistory.scanQr}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => pickupImageInputRef.current?.click()}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {t.seller.orderHistory.decodeQrImage}
                  </Button>
                  {isPickupScanning && (
                    <Button type="button" variant="ghost" onClick={stopPickupScanner}>
                      {t.seller.orderHistory.stopScanner}
                    </Button>
                  )}
                </div>

                <input
                  ref={pickupImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePickupImageScan}
                />

                <div className="overflow-hidden rounded-2xl border bg-black">
                  <video
                    ref={pickupVideoRef}
                    className={cn(
                      "h-52 w-full object-cover",
                      !isPickupScanning && "hidden"
                    )}
                    muted
                    playsInline
                  />
                  {!isPickupScanning && (
                    <div className="flex h-52 items-center justify-center px-6 text-center text-sm text-white/70">
                      {t.seller.orderHistory.qrPreview}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={pickupCode}
                    onChange={(event) => setPickupCode(event.target.value)}
                    placeholder="LB-48291"
                  />
                  <Button
                    type="button"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => void runPickupVerification(pickupCode)}
                  >
                    {t.seller.orderHistory.verifyCode}
                  </Button>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  {pickupMessage ?? t.seller.orderHistory.pickupInitial}
                </div>

                <div className="space-y-3">
                  {pickupOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{order.customerName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.offerTitle}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            order.status === "collected"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {order.status === "collected" ? t.seller.orderHistory.collected : t.seller.orderHistory.pending}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{order.reservationCode}</span>
                        <span>{order.pickupWindow}</span>
                        <span>${order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="border-b bg-card/70">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  {t.seller.orderHistory.packagesTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {publishedOffers.length === 0 ? (
                  <EmptyState
                    title={t.seller.orderHistory.noPackages}
                    description={t.seller.orderHistory.noPackagesDesc}
                  />
                ) : (
                  publishedOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{offer.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {offer.contents?.join(" · ") || t.seller.orderHistory.mealPackageFallback}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            ${offer.newPrice.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.seller.orderHistory.portions(offer.quantityAvailable ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {t.seller.orderHistory.pickupWindow(offer.pickupStart ?? "18:00", offer.endTime)}
                        </span>
                        <span>{t.seller.orderHistory.visibleOnFeed}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section id="insights" className="scroll-mt-24">
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b bg-card/70">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock3 className="h-5 w-5 text-secondary" />
                  {t.seller.insights.cardTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {inventory.length === 0 ? (
                  <EmptyState
                    title={t.seller.insights.noGoods}
                    description={t.seller.insights.noGoodsDesc}
                  />
                ) : (
                  inventory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t.seller.insights.barcodeLabel(item.barcode)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatExpiryDate(item.expiryDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.seller.insights.qtyLabel(item.quantity)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.seller.insights.capturedVia(item.source)}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            </section>

            <section id="settings" className="scroll-mt-24">
              <Card className="border-none shadow-sm">
                <CardHeader className="border-b bg-card/70">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5 text-primary" />
                    {t.seller.settings.cardTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.businessName}
                      <Input
                        value={profileDraft.businessName}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            businessName: event.target.value,
                          }))
                        }
                        placeholder={t.seller.settings.businessNamePlaceholder}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.businessType}
                      <select
                        value={profileDraft.businessType}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            businessType: event.target.value as SellerBusinessType,
                          }))
                        }
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
                      >
                        <option value="restaurant">{t.seller.settings.restaurant}</option>
                        <option value="shop">{t.seller.settings.shop}</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.category}
                      <Input
                        value={profileDraft.category}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                        placeholder={t.seller.settings.categoryPlaceholder}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.address}
                      <Input
                        value={profileDraft.address}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            address: event.target.value,
                          }))
                        }
                        placeholder={t.seller.settings.addressPlaceholder}
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.latitude}
                      <Input
                        value={profileDraft.latitude}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            latitude: event.target.value,
                          }))
                        }
                        placeholder="41.31348"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      {t.seller.settings.longitude}
                      <Input
                        value={profileDraft.longitude}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            longitude: event.target.value,
                          }))
                        }
                        placeholder="69.25726"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-sm font-semibold">{t.seller.settings.pickupOpsTitle}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.seller.settings.pickupOpsDesc(DEFAULT_PACKAGE_DRAFT.pickupStart, DEFAULT_PACKAGE_DRAFT.pickupEnd)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-sm font-semibold">{t.seller.settings.marketplaceTitle}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t.seller.settings.marketplaceDesc}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    {profileMessage ?? t.seller.settings.profileInitial}
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? t.seller.settings.saving : t.seller.settings.saveButton}
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="text-sm">{label}</span>
      {active && <div className="ml-auto h-4 w-1 rounded-full bg-primary" />}
    </button>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  delay = 0,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Card className="border-none shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="rounded-md bg-muted/50 p-2">{icon}</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default SellerDashboard;
