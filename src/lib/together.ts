// Pure logica voor samen plannen: date-ideeën, plannen en belangrijke datums.
// nextOccurrence volgt exact dezelfde regels als public.next_occurrence in de database.

export type Budget = 'gratis' | '€' | '€€' | '€€€';
export type Setting = 'binnen' | 'buiten';
export type DateKind = 'jubileum' | 'verjaardag' | 'anders';

export const BUDGETS: Budget[] = ['gratis', '€', '€€', '€€€'];
export const BUDGET_LABEL: Record<Budget, string> = { gratis: 'Gratis', '€': 'Goedkoop', '€€': 'Gemiddeld', '€€€': 'Uitpakken' };
export const KIND_LABEL: Record<DateKind, string> = { jubileum: 'Jubileum', verjaardag: 'Verjaardag', anders: 'Anders' };
export const REMIND_OPTIONS = [0, 1, 3, 7, 14] as const;

export type DateIdea = {
  id: number;
  slug: string;
  position: number;
  title: string;
  description: string;
  budget: Budget;
  setting: Setting;
  minutes: number;
};

export type Plan = {
  id: number;
  title: string;
  notes: string | null;
  planned_for: string | null;
  done: boolean;
  created_at: string;
  created_by: string;
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
