// Samen kaarten spelen: navigeren binnen de kaarten die je ziet. Getest in __tests__/cardSession.test.ts
import type { CardQuestion } from './cards';

export type CardSession = { couple_id: string; theme_id: number; question_id: number; started_by: string | null; expires_at: string };

/** Vorige of volgende kaart vanaf de huidige; staat de huidige niet in de lijst, dan de eerste. */
export function stepCard(cards: CardQuestion[], currentId: number, delta: number): number | null {
  if (cards.length === 0) return null;
  const i = cards.findIndex((c) => c.id === currentId);
  if (i === -1) return cards[0].id;
  const next = Math.min(Math.max(i + delta, 0), cards.length - 1);
  return cards[next].id;
}

/** Een willekeurige andere kaart (schudden), of dezelfde als er maar één is. */
export function randomCard(cards: CardQuestion[], currentId: number, rng: () => number = Math.random): number | null {
  const others = cards.filter((c) => c.id !== currentId);
  if (others.length === 0) return cards[0]?.id ?? null;
  return others[Math.floor(rng() * others.length)].id;
}
