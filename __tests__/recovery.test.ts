import { showRecoveryCard } from '../src/lib/recovery';

const now = new Date('2026-11-10T12:00:00Z');

describe('herstelkaart', () => {
  it('verschijnt na 7 dagen voor een account zonder e-mail', () => {
    expect(showRecoveryCard({ phoneOnly: true, createdAt: '2026-11-03T12:00:00Z', seen: false, now })).toBe(true);
    expect(showRecoveryCard({ phoneOnly: true, createdAt: '2026-11-04T12:00:00Z', seen: false, now })).toBe(false);
  });

  it('komt maar één keer en niet bij een account met e-mail', () => {
    expect(showRecoveryCard({ phoneOnly: true, createdAt: '2026-01-01T00:00:00Z', seen: true, now })).toBe(false);
    expect(showRecoveryCard({ phoneOnly: false, createdAt: '2026-01-01T00:00:00Z', seen: false, now })).toBe(false);
    expect(showRecoveryCard({ phoneOnly: true, createdAt: undefined, seen: false, now })).toBe(false);
  });
});
