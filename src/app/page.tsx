"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowUpDown, Heart, Leaf, ListFilter, Sparkles, TrendingDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OfferCard } from "@/components/OfferCard";
import { Badge } from "@/components/ui/badge";
import { OFFER_FILTERS, OFFERS } from "@/data/offers";
import { useT } from "@/i18n";
import { useFavorites } from "@/lib/favorites-store";
import { usePublishedSellerOffers } from "@/lib/marketplace-store";
import { useSearchQuery } from "@/lib/search-store";
import { cn } from "@/lib/utils";
import type { OfferFilterCategory } from "@/types/offer";
import type { MapTheme } from "@/components/map/OffersMap";

function MapLoader() {
  const t = useT();
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
      {t.home.loadingMap}
    </div>
  );
}

const OffersMap = dynamic(() => import("@/components/map/OffersMap"), {
  ssr: false,
  loading: () => <MapLoader />,
});

type SortMode = "expiry" | "price" | "discount" | "distance";

function toMinutes(endTime: string) {
  const [hours, minutes] = endTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseDistanceKm(distance: string): number {
  return parseFloat(distance.replace(/[^0-9.]/g, "")) || 0;
}

function useDesktopMapBreakpoint() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktop(mediaQuery.matches);

    updateViewport();

    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return isDesktop;
}

export default function Home() {
  const t = useT();
  const publishedOffers = usePublishedSellerOffers();
  const favorites = useFavorites();
  const searchQuery = useSearchQuery();

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: "expiry", label: t.home.sort.expiry },
    { value: "price", label: t.home.sort.price },
    { value: "discount", label: t.home.sort.discount },
    { value: "distance", label: t.home.sort.distance },
  ];

  const MAP_STYLE_OPTIONS: { value: MapTheme; label: string }[] = [
    { value: "clean", label: t.home.map.clean },
    { value: "standard", label: t.home.map.standard },
    { value: "dark", label: t.home.map.dark },
  ];

  const PLATFORM_STATS = [
    { icon: <Leaf className="h-4 w-4 text-green-600" />, value: "12,847", label: t.home.stats.meals, color: "bg-green-50 text-green-700" },
    { icon: <TrendingDown className="h-4 w-4 text-blue-600" />, value: "34.7 t", label: t.home.stats.co2, color: "bg-blue-50 text-blue-700" },
    { icon: <Users className="h-4 w-4 text-amber-600" />, value: "2,391", label: t.home.stats.rescuers, color: "bg-amber-50 text-amber-700" },
    { icon: <Heart className="h-4 w-4 text-pink-600" />, value: "89", label: t.home.stats.businesses, color: "bg-pink-50 text-pink-700" },
  ];

  const [activeCategory, setActiveCategory] = useState<OfferFilterCategory>("All");
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useState<MapTheme>("clean");
  const [sortMode, setSortMode] = useState<SortMode>("expiry");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const isDesktopMap = useDesktopMapBreakpoint();

  const marketplaceOffers = useMemo(
    () => [...publishedOffers, ...OFFERS],
    [publishedOffers]
  );

  const filterMeta = useMemo(
    () =>
      OFFER_FILTERS.map((category) => ({
        category,
        count:
          category === "All"
            ? marketplaceOffers.length
            : marketplaceOffers.filter((offer) => offer.category === category).length,
      })),
    [marketplaceOffers]
  );

  const filteredOffers = useMemo(() => {
    let result = activeCategory === "All"
      ? marketplaceOffers
      : marketplaceOffers.filter((offer) => offer.category === activeCategory);

    if (showFavoritesOnly) {
      result = result.filter((offer) => favorites.includes(offer.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (offer) =>
          offer.title.toLowerCase().includes(q) ||
          offer.restaurant.toLowerCase().includes(q) ||
          offer.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [activeCategory, marketplaceOffers, showFavoritesOnly, favorites, searchQuery]);

  const sortedOffers = useMemo(() => {
    const arr = [...filteredOffers];
    switch (sortMode) {
      case "price":
        return arr.sort((a, b) => a.newPrice - b.newPrice);
      case "discount":
        return arr.sort((a, b) => b.discount - a.discount);
      case "distance":
        return arr.sort((a, b) => parseDistanceKm(a.distance) - parseDistanceKm(b.distance));
      default:
        return arr.sort((a, b) => toMinutes(a.endTime) - toMinutes(b.endTime));
    }
  }, [filteredOffers, sortMode]);

  const visibleActiveOfferId = useMemo(() => {
    if (!activeOfferId) return null;
    return sortedOffers.some((offer) => offer.id === activeOfferId) ? activeOfferId : null;
  }, [activeOfferId, sortedOffers]);

  const hasActiveFilters = activeCategory !== "All" || showFavoritesOnly || searchQuery.trim() !== "";

  return (
    <main className="flex bg-muted/20">
      <div className="flex w-full flex-col lg:flex-row">
        <aside className="hidden border-r border-border bg-card/30 p-4 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-64px)] lg:w-[45%] lg:shrink-0">
          {isDesktopMap ? (
            <OffersMap
              offers={sortedOffers}
              activeOfferId={visibleActiveOfferId}
              mapTheme={mapTheme}
              onActiveOfferChange={setActiveOfferId}
            />
          ) : null}
        </aside>

        <section className="w-full p-4 md:p-8 lg:w-[55%]">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex flex-col gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t.home.badge}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {t.home.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t.home.subtitle}
              </p>
            </div>

            {/* Platform impact banner */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {PLATFORM_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className={cn("flex flex-col items-center gap-1 rounded-xl p-3 text-center", stat.color)}
                >
                  {stat.icon}
                  <span className="text-base font-bold leading-none">{stat.value}</span>
                  <span className="text-[10px] leading-tight opacity-80">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            <div className="mb-6 h-72 overflow-hidden rounded-2xl border border-border lg:hidden">
              {isDesktopMap === false ? (
                <OffersMap
                  offers={sortedOffers}
                  activeOfferId={visibleActiveOfferId}
                  mapTheme={mapTheme}
                  onActiveOfferChange={setActiveOfferId}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
                  {t.home.loadingMap}
                </div>
              )}
            </div>

            {/* Controls row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ListFilter className="h-4 w-4" />
                {t.home.offersShowing(sortedOffers.length)}
              </div>

              <div className="flex items-center gap-2">
                {/* Sort dropdown */}
                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="h-8 rounded-full border border-border bg-card pl-8 pr-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Map theme switcher */}
                <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
                  {MAP_STYLE_OPTIONS.map((style) => {
                    const isActive = style.value === mapTheme;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setMapTheme(style.value)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category + Favorites filter chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              {filterMeta.map(({ category, count }) => {
                const active = activeCategory === category && !showFavoritesOnly;
                return (
                  <Badge
                    key={category}
                    asChild
                    variant={active ? "default" : "outline"}
                    className={cn(
                      "shrink-0 px-0 py-0",
                      active && "bg-primary text-primary-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory(category);
                        setShowFavoritesOnly(false);
                      }}
                      className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
                    >
                      {t.categories[category as keyof typeof t.categories] ?? category}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </Badge>
                );
              })}

              {/* Favorites filter chip */}
              <Badge
                asChild
                variant={showFavoritesOnly ? "default" : "outline"}
                className={cn(
                  "shrink-0 px-0 py-0",
                  showFavoritesOnly && "bg-red-500 text-white"
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm"
                >
                  <Heart className={`h-3.5 w-3.5 ${showFavoritesOnly ? "fill-white" : ""}`} />
                  {t.home.saved}
                  {favorites.length > 0 && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      showFavoritesOnly
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {favorites.length}
                    </span>
                  )}
                </button>
              </Badge>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory("All");
                    setShowFavoritesOnly(false);
                  }}
                  className="text-xs font-semibold text-primary transition-colors hover:text-primary/70 self-center"
                >
                  {t.home.clearFilters}
                </button>
              )}
            </div>

            {sortedOffers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-lg font-semibold">
                  {searchQuery.trim()
                    ? t.home.noOffersSearch(searchQuery)
                    : showFavoritesOnly
                    ? t.home.noOffersEmpty
                    : t.home.noOffersCategory}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {showFavoritesOnly
                    ? t.home.noOffersHintFav
                    : t.home.noOffersHint}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {sortedOffers.map((offer, index) => (
                  <motion.div
                    key={offer.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.25 }}
                    onMouseEnter={() => setActiveOfferId(offer.id)}
                    onMouseLeave={() => setActiveOfferId(null)}
                    className={cn(
                      "h-full rounded-2xl transition-shadow",
                      visibleActiveOfferId === offer.id && "ring-2 ring-primary/40"
                    )}
                  >
                    <OfferCard offer={offer} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
