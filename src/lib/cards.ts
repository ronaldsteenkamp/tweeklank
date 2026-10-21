// Pure logica voor gesprekskaarten (filters en voortgang), getest in __tests__/cards.test.ts

export type MarkKind = 'besproken' | 'favoriet';
export type CardQuestion = { id: number; position: number; text: string; depth: number };
export type CardMark = { question_id: number; kind: MarkKind };

export type CardFilter = {
  depth: 0 | 1 | 2 | 3; // 0 = alles
  hideDiscussed: boolean;
  onlyFavorites: boolean;
};

export const DEFAULT_FILTER: CardFilter = { depth: 0, hideDiscussed: false, onlyFavorites: false };

export function isMarked(marks: CardMark[], questionId: number, kind: MarkKind): boolean {
  return marks.some((m) => m.question_id === questionId && m.kind === kind);
}

export function filterCards(questions: CardQuestion[], marks: CardMark[], filter: CardFilter): CardQuestion[] {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .filter((q) => filter.depth === 0 || q.depth === filter.depth)
    .filter((q) => !filter.hideDiscussed || !isMarked(marks, q.id, 'besproken'))
    .filter((q) => !filter.onlyFavorites || isMarked(marks, q.id, 'favoriet'));
}

export function progress(questionIds: number[], marks: CardMark[]): { discussed: number; total: number } {
  const ids = new Set(questionIds);
  const discussed = new Set(marks.filter((m) => m.kind === 'besproken' && ids.has(m.question_id)).map((m) => m.question_id));
  return { discussed: discussed.size, total: ids.size };
}

/** Houdt de huidige kaart binnen de lijst nadat een filter of markering de lijst kleiner maakte. */
export function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}
