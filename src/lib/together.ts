// Pure logica voor samen plannen: date-ideeën, plannen en belangrijke datums.
// nextOccurrence volgt exact dezelfde regels als public.next_occurrence in de database.

export type Budget = 'gratis' | '€' | '€€' | '€€€';
export type Setting = 'binnen' | 'buiten' | 'op afstand';
export type DateKind = 'jubileum' | 'verjaardag' | 'anders' | 'weerzien';

export const BUDGETS: Budget[] = ['gratis', '€', '€€', '€€€'];
export const BUDGET_LABEL: Record<Budget, string> = { gratis: 'Gratis', '€': 'Goedkoop', '€€': 'Gemiddeld', '€€€': 'Uitpakken' };
export const KIND_LABEL: Record<DateKind, string> = {
  jubileum: 'Jubileum',
  verjaardag: 'Verjaardag',
  weerzien: 'We zien elkaar weer',
  anders: 'Anders',
};
export const SETTING_LABEL: Record<Setting, string> = { binnen: 'Binnen', buiten: 'Buiten', 'op afstand': 'Op afstand' };
export const REMIND_OPTIONS = [0, 1, 3, 7, 14] as const;

export type Season = 'lente' | 'zomer' | 'herfst' | 'winter';
export type Holiday = 'sinterklaas' | 'koningsdag' | 'oud-en-nieuw';

export type DateIdea = {
  id: number;
  slug: string;
  position: number;
  title: string;
  description: string;
  budget: Budget;
  setting: Setting;
  minutes: number;
  /** null: past het hele jaar */
  season?: Season | null;
  holiday?: Holiday | null;
};

export type Plan = {
  id: number;
  title: string;
  notes: string | null;
  planned_for: string | null;
  done: boolean;
  created_at: string;
  created_by: string;
  date_idea_id?: number | null;
};

export type ImportantDate = {
  id: number;
  title: string;
  kind: DateKind;
  date: string;
  yearly: boolean;
  remind_days_before: number;
  created_by: string;
};

export function filterIdeas(ideas: DateIdea[], f: { budget: Budget | null; setting: Setting | null }): DateIdea[] {
  return [...ideas]
    .sort((a, b) => a.position - b.position)
    .filter((i) => !f.budget || i.budget === f.budget)
    .filter((i) => !f.setting || i.setting === f.setting);
}

// ---- datums (alles als 'YYYY-MM-DD', zonder tijdzone-gedoe) ----

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function dateInYear(iso: string, year: number): string {
  const [, m, d] = parts(iso);
  return toIso(year, m, Math.min(d, daysInMonth(year, m)));
}

export function nextOccurrence(iso: string, yearly: boolean, today: string): string | null {
  if (iso >= today) return iso;
  if (!yearly) return null;
  const year = parts(today)[0];
  const thisYear = dateInYear(iso, year);
  return thisYear >= today ? thisYear : dateInYear(iso, year + 1);
}

export function daysUntil(iso: string, today: string): number {
  const [y1, m1, d1] = parts(today);
  const [y2, m2, d2] = parts(iso);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function relativeLabel(days: number): string {
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Morgen';
  return `Over ${days} dagen`;
}

/** Jaren sinds de oorspronkelijke datum, op de eerstvolgende keer (bijv. "5 jaar samen"). */
export function yearsAt(iso: string, next: string): number {
  return parts(next)[0] - parts(iso)[0];
}

export function sortDates(dates: ImportantDate[], today: string) {
  return dates
    .map((d) => ({ ...d, next: nextOccurrence(d.date, d.yearly, today) }))
    .sort((a, b) => {
      if (a.next === b.next) return a.title.localeCompare(b.title);
      if (a.next === null) return 1;
      if (b.next === null) return -1;
      return a.next.localeCompare(b.next);
    });
}

/** Open plannen eerst (met datum op volgorde, dan zonder datum), afgeronde plannen onderaan. */
export function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.planned_for && b.planned_for) return a.planned_for.localeCompare(b.planned_for);
    if (a.planned_for) return -1;
    if (b.planned_for) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** Dag/maand/jaar uit invoervelden → 'YYYY-MM-DD', of null als de datum niet bestaat. */
export function parseDateParts(day: string, month: string, year: string): string | null {
  if (![day, month, year].every((p) => /^\d+$/.test(p.trim()))) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return toIso(y, m, d);
}

export function splitDate(iso: string | null): { day: string; month: string; year: string } {
  if (!iso) return { day: '', month: '', year: '' };
  const [y, m, d] = parts(iso);
  return { day: String(d), month: String(m), year: String(y) };
}

export function formatDateNl(iso: string): string {
  const [y, m, d] = parts(iso);
  return new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** De eerstvolgende "We zien elkaar weer" vanaf vandaag, of null. */
export function nextReunion(dates: Pick<ImportantDate, 'kind' | 'date' | 'yearly' | 'title'>[], today: string): { title: string; days: number } | null {
  const upcoming = dates
    .filter((d) => d.kind === 'weerzien')
    .map((d) => ({ title: d.title, next: nextOccurrence(d.date, d.yearly, today) }))
    .filter((d): d is { title: string; next: string } => d.next !== null)
    .sort((a, b) => a.next.localeCompare(b.next));
  return upcoming[0] ? { title: upcoming[0].title, days: daysUntil(upcoming[0].next, today) } : null;
}

/** "Nog 12 dagen tot jullie elkaar weer zien" */
export function reunionLabel(days: number): string {
  if (days === 0) return 'Vandaag zien jullie elkaar weer';
  if (days === 1) return 'Morgen zien jullie elkaar weer';
  return `Nog ${days} dagen tot jullie elkaar weer zien`;
}

// ---- seizoenen en "Plan iets voor dit weekend" ----

/** Meteorologisch seizoen van een dag ('YYYY-MM-DD'). */
export function seasonOf(iso: string): Season {
  const m = +iso.slice(5, 7);
  return m >= 3 && m <= 5 ? 'lente' : m >= 6 && m <= 8 ? 'zomer' : m >= 9 && m <= 11 ? 'herfst' : 'winter';
}

/** Eerstvolgende datum van een feestdag. Koningsdag valt op 26 april als 27 april een zondag is. */
export function nextHoliday(holiday: Holiday, today: string): string {
  const year = +today.slice(0, 4);
  const on = (y: number) => {
    if (holiday === 'sinterklaas') return toIso(y, 12, 5);
    if (holiday === 'oud-en-nieuw') return toIso(y, 12, 31);
    return new Date(Date.UTC(y, 3, 27)).getUTCDay() === 0 ? toIso(y, 4, 26) : toIso(y, 4, 27);
  };
  return on(year) >= today ? on(year) : on(year + 1);
}

/** Feestdag-ideeën tonen we alleen in de drie weken ervoor (en op de dag zelf). */
export const HOLIDAY_WINDOW_DAYS = 21;

/**
 * Drie ideeën voor dit weekend: passend bij het seizoen (of het hele jaar), het gekozen budget en
 * binnen/buiten/op afstand. Ideeën die nog niet op jullie lijst staan, gaan voor; een feestdag die
 * eraan komt ook. Binnen dezelfde voorkeur is de volgorde willekeurig.
 */
export function suggestWeekend(
  ideas: DateIdea[],
  f: { today: string; budget: Budget | null; setting: Setting | null; plannedIdeaIds: number[]; rng?: () => number },
  count = 3,
): DateIdea[] {
  const season = seasonOf(f.today);
  const planned = new Set(f.plannedIdeaIds);
  const rng = f.rng ?? Math.random;
  return ideas
    .filter((i) => !i.season || i.season === season)
    .filter((i) => !i.holiday || daysUntil(nextHoliday(i.holiday, f.today), f.today) <= HOLIDAY_WINDOW_DAYS)
    .filter((i) => !f.budget || i.budget === f.budget)
    .filter((i) => !f.setting || i.setting === f.setting)
    .map((i) => ({
      i,
      score: (planned.has(i.id) ? 0 : 4) + (i.holiday ? 2 : 0) + (i.season ? 1 : 0),
      tie: rng(),
    }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, count)
    .map((x) => x.i);
}
