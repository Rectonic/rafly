import { favoritesReducer } from '@/lib/favorites-store';

describe('favoritesReducer', () => {
  it('adds an id when toggling a non-favorite', () => {
    const next = favoritesReducer(
      { ids: [], loaded: true },
      { type: 'TOGGLE', id: 'offer-1' }
    );
    expect(next.ids).toEqual(['offer-1']);
  });

  it('removes an id when toggling an existing favorite', () => {
    const next = favoritesReducer(
      { ids: ['offer-1', 'offer-2'], loaded: true },
      { type: 'TOGGLE', id: 'offer-1' }
    );
    expect(next.ids).toEqual(['offer-2']);
  });

  it('loads favorites from storage', () => {
    const next = favoritesReducer(
      { ids: [], loaded: false },
      { type: 'LOAD', ids: ['a', 'b', 'c'] }
    );
    expect(next.ids).toEqual(['a', 'b', 'c']);
    expect(next.loaded).toBe(true);
  });

  it('is idempotent — toggling twice returns to original state', () => {
    const state1 = favoritesReducer({ ids: [], loaded: true }, { type: 'TOGGLE', id: 'x' });
    const state2 = favoritesReducer(state1, { type: 'TOGGLE', id: 'x' });
    expect(state2.ids).toEqual([]);
  });
});
