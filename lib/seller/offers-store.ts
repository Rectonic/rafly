import { useCallback, useEffect, useMemo, useState } from "react";

import { useRefreshPublishedSellerOffers } from "@/lib/marketplace-store";
import { useAuth } from "@/lib/seller/auth-store";
import type { CreateSellerOfferInput } from "@/lib/seller/contracts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { LocalizedOfferContent } from "@/types/offer";
import type { SellerOffer, SellerProfile } from "@/types/seller";

type SellerOfferRow = {
  id: string;
  seller_id: string;
  title: string;
  business_name: string;
  category: SellerOffer["category"];
  image: string | null;
  old_price: number;
  new_price: number;
  discount: number;
  distance_text: string;
  pickup_start: string | null;
  pickup_end: string;
  quantity_available: number;
  contents: string[] | null;
  allergens?: string[] | null;
  cancellation_policy?: string | null;
  dietary_badges?: string[] | null;
  pickup_instructions?: string | null;
  source: string;
  business_type: SellerOffer["businessType"];
  latitude: number;
  longitude: number;
  address: string;
  rating: number;
  reviews: number;
  status: SellerOffer["status"];
  published_at: string;
  translations?: LocalizedOfferContent | null;
};

function mergeSellerProfileTranslations(
  offerTranslations: LocalizedOfferContent | undefined,
  profileTranslations: SellerProfile["translations"] | undefined
): LocalizedOfferContent | undefined {
  const merged: LocalizedOfferContent = { ...offerTranslations };

  (["en", "ru"] as const).forEach((locale) => {
    const profileTranslation = profileTranslations?.[locale];
    const restaurant = profileTranslation?.businessName?.trim();
    const locationAddress = profileTranslation?.address?.trim();

    if (!restaurant && !locationAddress) {
      return;
    }

    merged[locale] = {
      ...merged[locale],
      locationAddress: locationAddress || merged[locale]?.locationAddress,
      restaurant: restaurant || merged[locale]?.restaurant,
    };
  });

  return Object.keys(merged).length ? merged : undefined;
}

function mapSellerOffer(row: SellerOfferRow): SellerOffer {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    businessName: row.business_name,
    category: row.category,
    image: row.image,
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    discount: row.discount,
    distanceText: row.distance_text,
    pickupStart: row.pickup_start,
    pickupEnd: row.pickup_end,
    quantityAvailable: row.quantity_available,
    contents: row.contents ?? [],
    allergens: row.allergens ?? undefined,
    cancellationPolicy: row.cancellation_policy ?? undefined,
    dietaryBadges: row.dietary_badges ?? undefined,
    pickupInstructions: row.pickup_instructions ?? undefined,
    source: row.source,
    businessType: row.business_type,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    rating: Number(row.rating),
    reviews: row.reviews,
    status: row.status,
    publishedAt: row.published_at,
    translations: row.translations ?? undefined,
  };
}

export function useSellerOffers() {
  const { sellerProfile, session } = useAuth();
  const refreshPublishedOffers = useRefreshPublishedSellerOffers();
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !session?.user) {
      setOffers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("seller_offers")
        .select("*")
        .eq("seller_id", session.user.id)
        .order("published_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setOffers((data ?? []).map((row) => mapSellerOffer(row as SellerOfferRow)));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load seller offers."
      );
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  const publishOffer = useCallback(
    async (input: CreateSellerOfferInput) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user || !sellerProfile) {
        const missingSellerError = new Error("Seller auth and profile are required.");
        setError(missingSellerError.message);
        throw missingSellerError;
      }

      const discount = Math.round(
        ((input.oldPrice - input.newPrice) / input.oldPrice) * 100
      );

      const { error: createError } = await supabase.from("seller_offers").insert({
        address: sellerProfile.address,
        business_name: sellerProfile.businessName,
        business_type: sellerProfile.businessType,
        category: input.category,
        contents: input.contents,
        allergens: input.allergens ?? [],
        cancellation_policy: input.cancellationPolicy ?? null,
        discount,
        dietary_badges: input.dietaryBadges ?? [],
        distance_text: "0.0 km",
        image: input.image,
        latitude: sellerProfile.latitude,
        longitude: sellerProfile.longitude,
        new_price: input.newPrice,
        old_price: input.oldPrice,
        pickup_end: input.pickupEnd,
        pickup_instructions: input.pickupInstructions ?? null,
        pickup_start: input.pickupStart,
        quantity_available: input.quantityAvailable,
        rating: sellerProfile.rating,
        reviews: sellerProfile.reviews,
        seller_id: session.user.id,
        source: "seller",
        status: "published",
        title: input.title,
        translations: mergeSellerProfileTranslations(
          input.translations,
          sellerProfile.translations
        ) ?? {},
      });

      if (createError) {
        setError(createError.message);
        throw createError;
      }

      await Promise.all([loadOffers(), refreshPublishedOffers()]);
    },
    [loadOffers, refreshPublishedOffers, sellerProfile, session?.user]
  );

  const deleteOffer = useCallback(
    async (offerId: string) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error("Supabase is not configured.");
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      const { error: deleteError } = await supabase
        .from("seller_offers")
        .delete()
        .eq("id", offerId)
        .eq("seller_id", session.user.id);

      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }

      await Promise.all([loadOffers(), refreshPublishedOffers()]);
    },
    [loadOffers, refreshPublishedOffers, session?.user]
  );

  return useMemo(
    () => ({
      deleteOffer,
      error,
      isLoading,
      offers,
      publishOffer,
      refreshOffers: loadOffers,
    }),
    [deleteOffer, error, isLoading, loadOffers, offers, publishOffer]
  );
}
