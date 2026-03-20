import { filterAndSort } from '@/lib/filters';
import { OFFERS } from '@/data/offers';
import type { Offer } from '@/types/offer';

const offers = OFFERS;

describe('filterAndSort — category filter', () => {
  it('returns all offers when category is "All"', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'expiry' });
    expect(result).toHaveLength(offers.length);
  });

  it('filters to only Meals offers', () => {
    const result = filterAndSort(offers, { category: 'Meals', searchQuery: '', sortMode: 'expiry' });
    expect(result.every((o) => o.category === 'Meals')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for category with no matches', () => {
    const noCategory = filterAndSort(
      [{ ...offers[0], category: 'Meals' }],
      { category: 'Vegan', searchQuery: '', sortMode: 'expiry' }
    );
    expect(noCategory).toHaveLength(0);
  });
});

describe('filterAndSort — search filter', () => {
  it('filters by restaurant name (case-insensitive)', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'tokyo', sortMode: 'expiry' });
    expect(result.some((o) => o.restaurant === 'Tokyo Bites')).toBe(true);
  });

  it('filters by offer title', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'pasta', sortMode: 'expiry' });
    expect(result.some((o) => o.title.toLowerCase().includes('pasta'))).toBe(true);
  });

  it('returns empty for no match', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'zzzzzzzz', sortMode: 'expiry' });
    expect(result).toHaveLength(0);
  });
});

describe('filterAndSort — favorites filter', () => {
  it('returns only favorited offers', () => {
    const favoriteIds = [offers[0].id, offers[2].id];
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: true,
      favoriteIds,
    });
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(expect.arrayContaining(favoriteIds));
  });

  it('returns all when showFavoritesOnly is false', () => {
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: false,
      favoriteIds: [offers[0].id],
    });
    expect(result).toHaveLength(offers.length);
  });

  it('returns empty array when showFavoritesOnly is true with empty favoriteIds', () => {
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: true,
      favoriteIds: [],
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty when showFavoritesOnly is true and favoriteIds is omitted', () => {
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: true,
      // no favoriteIds
    });
    expect(result).toHaveLength(0);
  });
});

describe('filterAndSort — sort modes', () => {
  it('sorts by price ascending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'price' });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].newPrice).toBeGreaterThanOrEqual(result[i - 1].newPrice);
    }
  });

  it('sorts by discount descending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'discount' });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].discount).toBeLessThanOrEqual(result[i - 1].discount);
    }
  });

  it('sorts by distance ascending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'distance' });
    for (let i = 1; i < result.length; i++) {
      const prev = parseFloat(result[i - 1].distance);
      const curr = parseFloat(result[i].distance);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('sorts by expiry ascending (minutes from midnight)', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'expiry' });
    function toMins(t: string) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }
    for (let i = 1; i < result.length; i++) {
      expect(toMins(result[i].endTime)).toBeGreaterThanOrEqual(toMins(result[i - 1].endTime));
    }
  });
});

describe('filterAndSort — edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(filterAndSort([], { category: 'All', searchQuery: '', sortMode: 'expiry' })).toEqual([]);
  });

  it('combines category and search filters', () => {
    const result = filterAndSort(offers, { category: 'Vegan', searchQuery: 'green', sortMode: 'price' });
    expect(result.every((o) => o.category === 'Vegan')).toBe(true);
    expect(result.some((o) => o.restaurant.toLowerCase().includes('green'))).toBe(true);
  });
});
