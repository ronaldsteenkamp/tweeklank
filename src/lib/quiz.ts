// Pure quizlogica (geen netwerk), getest in __tests__/quiz.test.ts

export type QuizKind = 'self' | 'guess';

export type QuizResultRow = {
  question_id: number;
  position: number;
  prompt: string;
  options: string[];
  my_self: number;
  partner_self: number;
  my_guess: number;
  partner_guess: number;
};

export type QuizSummary = {
  total: number;
  myScore: number;
  partnerScore: number;
  same: QuizResultRow[];
  different: QuizResultRow[];
};

export function summarize(rows: QuizResultRow[]): QuizSummary {
  return {
    total: rows.length,
    myScore: rows.filter((r) => r.my_guess === r.partner_self).length,
    partnerScore: rows.filter((r) => r.partner_guess === r.my_self).length,
    same: rows.filter((r) => r.my_self === r.partner_self),
    different: rows.filter((r) => r.my_self !== r.partner_self),
  };
}

export function scoreMessage(score: number, total: number): string {
  const ratio = total ? score / total : 0;
  if (ratio === 1) return 'Foutloos! Jij kent elkaar door en door.';
  if (ratio >= 0.7) return 'Sterk! Jij weet heel goed hoe je partner in elkaar zit.';
  if (ratio >= 0.4) return 'Mooi begin. Er valt nog genoeg te ontdekken.';
  return 'Verrassingen genoeg! Mooie aanleiding voor een goed gesprek.';
}

/** Waar ga je verder? Eerst alle vragen over jezelf, dan alle gokken over je partner. */
export function nextStep(
  questionIds: number[],
  answered: { question_id: number; kind: QuizKind }[],
): { kind: QuizKind; index: number } | null {
  const has = (kind: QuizKind, id: number) => answered.some((a) => a.kind === kind && a.question_id === id);
  for (const kind of ['self', 'guess'] as const) {
    const index = questionIds.findIndex((id) => !has(kind, id));
    if (index !== -1) return { kind, index };
  }
  return null;
}

export type QuizStatus = 'nieuw' | 'bezig' | 'wachten' | 'klaar';

export function quizStatus(myProgress: number, questionCount: number, partnerDone: boolean): QuizStatus {
  if (myProgress === 0) return 'nieuw';
  if (myProgress < questionCount * 2) return 'bezig';
  return partnerDone ? 'klaar' : 'wachten';
}
