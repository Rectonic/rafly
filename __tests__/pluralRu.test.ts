import { pluralRu } from '@/i18n/ru';

describe('pluralRu', () => {
  it('returns "one" form for 1, 21, 31', () => {
    expect(pluralRu(1, 'штука', 'штуки', 'штук')).toBe('штука');
    expect(pluralRu(21, 'штука', 'штуки', 'штук')).toBe('штука');
    expect(pluralRu(31, 'штука', 'штуки', 'штук')).toBe('штука');
  });

  it('returns "few" form for 2, 3, 4, 22, 23, 24', () => {
    expect(pluralRu(2, 'штука', 'штуки', 'штук')).toBe('штуки');
    expect(pluralRu(4, 'штука', 'штуки', 'штук')).toBe('штуки');
    expect(pluralRu(22, 'штука', 'штуки', 'штук')).toBe('штуки');
  });

  it('returns "many" form for 5-20, 11, 12, 13, 14', () => {
    expect(pluralRu(5, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(11, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(12, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(14, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(20, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(100, 'штука', 'штуки', 'штук')).toBe('штук');
  });
});
