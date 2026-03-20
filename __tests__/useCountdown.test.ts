import { calcCountdown } from '@/hooks/useCountdown';

// Helper: build a fixed "now" at a given HH:MM
function at(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

describe('calcCountdown', () => {
  it('returns hours + minutes when more than 60 min remain', () => {
    // endTime 20:00, now 17:30 → 2h 30m remain
    const result = calcCountdown('20:00', at(17, 30));
    expect(result.hours).toBe(2);
    expect(result.mins).toBe(30);
    expect(result.urgent).toBe(false);
  });

  it('returns 0 hours when under 60 min remain', () => {
    // endTime 20:00, now 19:45 → 0h 15m
    const result = calcCountdown('20:00', at(19, 45));
    expect(result.hours).toBe(0);
    expect(result.mins).toBe(15);
  });

  it('marks urgent when under 30 min remain', () => {
    const result = calcCountdown('20:00', at(19, 31));
    expect(result.urgent).toBe(true);
  });

  it('wraps to next day when endTime has passed', () => {
    // endTime 08:00, now 22:00 → wraps: ~10h remain
    const result = calcCountdown('08:00', at(22, 0));
    expect(result.hours).toBeGreaterThan(0);
    expect(result.urgent).toBe(false);
  });
});
