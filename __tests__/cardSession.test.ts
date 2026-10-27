import { randomCard, stepCard } from '../src/lib/cardSession';

const cards = [1, 2, 3].map((id) => ({ id, position: id, text: `Kaart ${id}`, depth: 1 }));

describe('samen kaarten spelen', () => {
  it('gaat naar de vorige en volgende kaart, binnen de lijst', () => {
    expect(stepCard(cards, 2, 1)).toBe(3);
    expect(stepCard(cards, 3, 1)).toBe(3);
    expect(stepCard(cards, 1, -1)).toBe(1);
    expect(stepCard(cards, 99, 1)).toBe(1); // huidige kaart valt buiten het filter
    expect(stepCard([], 1, 1)).toBeNull();
  });

  it('schudt naar een andere kaart', () => {
    expect(randomCard(cards, 1, () => 0)).toBe(2);
    expect(randomCard(cards, 1, () => 0.99)).toBe(3);
    expect(randomCard([cards[0]], 1)).toBe(1);
  });
});
