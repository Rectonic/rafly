import type { Offer, OfferFilterCategory } from '@/types/offer';

export type SortMode = 'expiry' | 'price' | 'discount' | 'distance';

export interface FilterOptions {
  category: OfferFilterCategory;
  searchQuery: string;
  sortMode: SortMode;
  showFavoritesOnly?: boolean;
  favoriteIds?: string[];
}

function parseMinutes(endTime: string): number {
  const [h, m] = endTime.split(':').map(Number);
  return h * 60 + m;
}

function parseDistance(distance: string): number {
  return parseFloat(distance);
}

export function filterAndSort(offers: Offer[], options: FilterOptions): Offer[] {
  const { category, searchQuery, sortMode, showFavoritesOnly, favoriteIds } = options;

  let result = offers;

  // 1. Category filter
  if (category !== 'All') {
    result = result.filter((o) => o.category === category);
  }

  // 2. Favorites filter (Favorites screen only)
  if (showFavoritesOnly) {
    const favSet = new Set(favoriteIds ?? []);
    result = result.filter((o) => favSet.has(o.id));
  }

  // 3. Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.restaurant.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q)
    );
  }

  // 4. Sort
  const sorted = [...result];
  switch (sortMode) {
    case 'expiry':
      sorted.sort((a, b) => parseMinutes(a.endTime) - parseMinutes(b.endTime));
      break;
    case 'price':
      sorted.sort((a, b) => a.newPrice - b.newPrice);
      break;
    case 'discount':
      sorted.sort((a, b) => b.discount - a.discount);
      break;
    case 'distance':
      sorted.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
      break;
  }

  return sorted;
}
