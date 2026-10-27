// Weekritme: teksten voor samen-dagen, de reeks in weken en de pauze. Getest in __tests__/rhythm.test.ts
// Bewust zonder verliestaal en zonder iets per partner: alleen wat jullie samen doen.
import { formatDayNl } from './dates';

export type WeekStatus = {
  week_start: string;
  together_days: number;
  goal: number;
  chosen_goal: number;
  streak: number;
  week_paused: boolean;
  pause_active: boolean;
  pause_end: string | null;
};

export const WEEK_GOALS = [3, 4, 5, 6, 7] as const;
export const PAUSE_OPTIONS: { weeks: 1 | 2 | 4 | null; label: string }[] = [
  { weeks: 1, label: '1 week' },
  { weeks: 2, label: '2 weken' },
  { weeks: 4, label: '4 weken' },
  { weeks: null, label: 'Tot we hem uitzetten' },
];

/** "4 van 5 samen-dagen deze week" */
export function weekLabel(s: Pick<WeekStatus, 'together_days' | 'goal'>): string {
  return `${s.together_days} van ${s.goal} samen-dagen deze week`;
}

/** "12 weken op rij", of null als er (nog) geen reeks is. */
export function streakLabel(streak: number): string | null {
  if (streak <= 0) return null;
  return streak === 1 ? '1 week op rij' : `${streak} weken op rij`;
}

/** Korte tekst over de pauze, of null als er niets gepauzeerd is. */
export function pauseLabel(s: Pick<WeekStatus, 'week_paused' | 'pause_active' | 'pause_end'>, today?: string): string | null {
  if (s.pause_active && s.pause_end) return `Jullie ritme staat op pauze tot en met ${formatDayNl(s.pause_end, today)}.`;
  if (s.pause_active) return 'Jullie ritme staat op pauze tot een van jullie hem uitzet.';
  if (s.week_paused) return 'Deze week telt niet mee voor jullie ritme. Dat is prima.';
  return null;
}

/** Het doel is deze week gehaald. */
export function goalReached(s: Pick<WeekStatus, 'together_days' | 'goal'>): boolean {
  return s.together_days >= s.goal;
}
