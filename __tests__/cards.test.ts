import { clampIndex, DEFAULT_FILTER, filterCards, isMarked, progress, type CardMark, type CardQuestion } from '../src/lib/cards';

const q = (id: number, depth: number): CardQuestion => ({ id, position: id, text: `Vraag ${id}`, depth });
const questions = [q(3, 2), q(1, 1), q(2, 1), q(4, 3), q(5, 3)];
const marks: CardMark[] = [
  { question_id: 1, kind: 'besproken' },
  { question_id: 4, kind: 'besproken' },
  { question_id: 4, kind: 'favoriet' },
  { question_id: 99, kind: 'besproken' }, // ander thema
];

describe('gesprekskaarten', () => {
  it('toont alles op volgorde zonder filter', () => {
    expect(filterCards(questions, marks, DEFAULT_FILTER).map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('filtert op diepgang', () => {
    expect(filterCards(questions, marks, { ...DEFAULT_FILTER, depth: 1 }).map((c) => c.id)).toEqual([1, 2]);
    expect(filterCards(questions, marks, { ...DEFAULT_FILTER, depth: 3 }).map((c) => c.id)).toEqual([4, 5]);
  });

  it('verbergt besproken kaarten', () => {
    expect(filterCards(questions, marks, { ...DEFAULT_FILTER, hideDiscussed: true }).map((c) => c.id)).toEqual([2, 3, 5]);
  });

  it('toont alleen favorieten, ook gecombineerd met diepgang', () => {
    expect(filterCards(questions, marks, { ...DEFAULT_FILTER, onlyFavorites: true }).map((c) => c.id)).toEqual([4]);
    expect(filterCards(questions, marks, { ...DEFAULT_FILTER, onlyFavorites: true, depth: 1 })).toEqual([]);
  });

  it('telt voortgang alleen binnen het thema', () => {
    expect(progress(questions.map((c) => c.id), marks)).toEqual({ discussed: 2, total: 5 });
  });

  it('herkent markeringen', () => {
    expect(isMarked(marks, 4, 'favoriet')).toBe(true);
    expect(isMarked(marks, 1, 'favoriet')).toBe(false);
  });

  it('houdt de index binnen de lijst', () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(2, 0)).toBe(0);
  });
});
