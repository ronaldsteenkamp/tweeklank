// Maandelijkse check-in: vragen, verschuivingen en het rustige signaal bij lage scores.
// Geen totaalscore en geen vergelijking tussen partners. Getest in __tests__/checkin.test.ts

export type ScaleKey = 'connection' | 'appreciated' | 'conflict' | 'time_together';

export type Checkin = {
  id: number;
  user_id: string;
  month: string;
  connection: number;
  appreciated: number;
  conflict: number;
  time_together: number;
  wish: string | null;
};

export const SCALES: { key: ScaleKey; label: string; question: string; exercises: string[] }[] = [
  { key: 'connection', label: 'Verbondenheid', question: 'Hoe verbonden voel je je met elkaar?', exercises: ['ex-weekgesprek', 'ex-knuffel'] },
  { key: 'appreciated', label: 'Gewaardeerd voelen', question: 'Hoe gewaardeerd voel je je?', exercises: ['ex-waardering', 'ex-briefje'] },
  { key: 'conflict', label: 'Onenigheid oplossen', question: 'Hoe tevreden ben je over hoe jullie onenigheid oplossen?', exercises: ['ex-timeout', 'ex-herstel'] },
  { key: 'time_together', label: 'Tijd samen', question: 'Hoe tevreden ben je over jullie tijd samen?', exercises: ['ex-schermvrij', 'ex-toekomstdroom'] },
];

export const WISH_QUESTION = 'Wat zou je volgende maand graag samen doen?';

export type Shift = 'iets meer' | 'gelijk' | 'iets minder';

/** Eerste dag van de vorige maand: '2026-11-01' → '2026-10-01' */
export function previousMonth(month: string): string {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
}

/** Verschuiving ten opzichte van de vorige maand, of null als er geen vorige maand is. */
export function shift(now: number, before: number | null | undefined): Shift | null {
  if (before == null) return null;
  return now > before ? 'iets meer' : now < before ? 'iets minder' : 'gelijk';
}

/** Per schaal de verschuiving voor één persoon. */
export function shiftsFor(rows: Checkin[], userId: string, month: string): Partial<Record<ScaleKey, Shift>> {
  const now = rows.find((r) => r.user_id === userId && r.month === month);
  const before = rows.find((r) => r.user_id === userId && r.month === previousMonth(month));
  const out: Partial<Record<ScaleKey, Shift>> = {};
  if (!now) return out;
  for (const s of SCALES) {
    const v = shift(now[s.key], before?.[s.key]);
    if (v) out[s.key] = v;
  }
  return out;
}

/** Schalen waar iemand twee maanden op rij 1 of 2 gaf. Zegt bewust niet bij wie. */
export function lowScales(rows: Checkin[], month: string): ScaleKey[] {
  const prev = previousMonth(month);
  const users = [...new Set(rows.map((r) => r.user_id))];
  return SCALES.filter((s) =>
    users.some((u) => {
      const now = rows.find((r) => r.user_id === u && r.month === month);
      const before = rows.find((r) => r.user_id === u && r.month === prev);
      return !!now && !!before && now[s.key] <= 2 && before[s.key] <= 2;
    }),
  ).map((s) => s.key);
}

/** De meest recente maand waarin jij de check-in invulde. */
export function latestOwnMonth(rows: Checkin[], userId: string): string | null {
  const months = rows.filter((r) => r.user_id === userId).map((r) => r.month).sort();
  return months.length ? months[months.length - 1] : null;
}
