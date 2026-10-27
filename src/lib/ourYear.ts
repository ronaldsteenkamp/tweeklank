// "Ons jaar": een overzicht dat volledig op het toestel wordt gemaakt, uit gegevens die jullie al
// konden zien. Geen scores die partners vergelijken. Getest in __tests__/ourYear.test.ts
import type { Plan } from './together';
import type { ArchiveDay } from './types';

export type YearPeriod = { start: string; end: string; year: number; complete: boolean; label: string };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const toDate = (s: string) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));

/** Dezelfde datum n jaar later (29 februari wordt 28 februari in een gewoon jaar). */
function plusYears(start: string, n: number): string {
  const y = +start.slice(0, 4) + n;
  const m = +start.slice(5, 7);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(Math.min(+start.slice(8, 10), last))}`;
}

function minusDay(s: string): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}

function fullYears(start: string, today: string): number {
  let n = 0;
  while (plusYears(start, n + 1) <= today) n++;
  return n;
}

/**
 * Welk jaar tonen we? Tot 30 dagen na de verjaardag van de koppeling het jaar dat net af is,
 * anders het lopende jaar tot vandaag.
 */
export function yearPeriod(coupleStart: string, today: string): YearPeriod {
  const n = fullYears(coupleStart, today);
  const anniversary = plusYears(coupleStart, n);
  const daysSince = (toDate(today).getTime() - toDate(anniversary).getTime()) / 86_400_000;
  if (n >= 1 && daysSince < 30) {
    return { start: plusYears(coupleStart, n - 1), end: minusDay(anniversary), year: n, complete: true, label: `Jullie jaar ${n}` };
  }
  return {
    start: anniversary,
    end: today,
    year: n + 1,
    complete: false,
    label: n === 0 ? 'Jullie eerste jaar tot nu' : `Jullie jaar ${n + 1} tot nu`,
  };
}

/** Is het vandaag precies een, twee, … jaar geleden dat jullie koppelden? Geeft het aantal jaren of 0. */
export function anniversaryToday(coupleStart: string, today: string): number {
  const n = fullYears(coupleStart, today);
  return n >= 1 && plusYears(coupleStart, n) === today ? n : 0;
}

export type QuizScore = { title: string; question_count: number; my_score: number | null; partner_score: number | null };

export type OurYear = {
  togetherDays: number;
  heartDays: { day: string; question: string; answers: { mine: boolean; body: string }[] }[];
  donePlans: string[];
  bestQuiz: { title: string; correct: number; total: number } | null;
  favorites: string[];
};

const HEART = '❤️';

export function buildOurYear(params: {
  period: Pick<YearPeriod, 'start' | 'end'>;
  meId: string;
  archive: ArchiveDay[];
  plans: Plan[];
  quizzes: QuizScore[];
  favorites: string[];
}): OurYear {
  const inPeriod = (day: string) => day >= params.period.start && day <= params.period.end;
  const days = params.archive.filter((d) => inPeriod(d.day));
  const together = days.filter((d) => new Set(d.daily_answers.map((a) => a.user_id)).size >= 2);

  // Allebei met een hartje: elk antwoord kreeg een hartje van de ander
  const heartDays = together
    .filter((d) =>
      d.daily_answers.every((a) => a.answer_reactions.some((r) => r.user_id !== a.user_id && r.emoji === HEART)),
    )
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: d.day,
      question: d.daily_questions.text,
      answers: [...d.daily_answers]
        .sort((a, b) => Number(b.user_id === params.meId) - Number(a.user_id === params.meId))
        .map((a) => ({ mine: a.user_id === params.meId, body: a.body })),
    }));

  const scored = params.quizzes
    .filter((q) => q.my_score !== null && q.partner_score !== null)
    .map((q) => ({ title: q.title, correct: (q.my_score ?? 0) + (q.partner_score ?? 0), total: 2 * q.question_count }))
    .sort((a, b) => b.correct / b.total - a.correct / a.total);

  return {
    togetherDays: together.length,
    heartDays,
    donePlans: params.plans.filter((p) => p.done && inPeriod(p.created_at.slice(0, 10))).map((p) => p.title),
    bestQuiz: scored[0] ?? null,
    favorites: params.favorites,
  };
}
