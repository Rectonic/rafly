import { favoritesReducer } from '@/lib/favorites-store';

describe('favoritesReducer', () => {
  it('adds an id when toggling a non-favorite', () => {
    const next = favoritesReducer([], { type: 'TOGGLE', id: 'offer-1' });
    expect(next).toEqual(['offer-1']);
  });

  it('removes an id when toggling an existing favorite', () => {
    const next = favoritesReducer(
      ['offer-1', 'offer-2'],
      { type: 'TOGGLE', id: 'offer-1' }
    );
    expect(next).toEqual(['offer-2']);
  });

  it('loads favorites from storage', () => {
    const next = favoritesReducer([], { type: 'LOAD', ids: ['a', 'b', 'c'] });
    expect(next).toEqual(['a', 'b', 'c']);
  });

  it('is idempotent — toggling twice returns to original state', () => {
    const state1 = favoritesReducer([], { type: 'TOGGLE', id: 'x' });
    const state2 = favoritesReducer(state1, { type: 'TOGGLE', id: 'x' });
    expect(state2).toEqual([]);
  });
});
