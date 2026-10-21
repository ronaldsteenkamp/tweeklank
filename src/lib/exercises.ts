// Pure logica voor oefeningen, getest in __tests__/exercises.test.ts

export type ExerciseCategory = 'communicatie' | 'waardering' | 'conflict' | 'verbinding';

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  communicatie: 'Communicatie',
  waardering: 'Waardering',
  conflict: 'Conflict',
  verbinding: 'Verbinding',
};

export type Exercise = {
  id: number;
  slug: string;
  position: number;
  title: string;
  category: ExerciseCategory;
  minutes: number;
  intro: string;
  steps: string[];
  why: string;
};

export type Completion = {
  id: number;
  exercise_id: number;
  user_id: string;
  completed_at: string;
  note: string | null;
};

export function filterExercises(list: Exercise[], category: ExerciseCategory | null): Exercise[] {
  return [...list].sort((a, b) => a.position - b.position).filter((e) => !category || e.category === category);
}

export function completionCounts(completions: Completion[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of completions) counts.set(c.exercise_id, (counts.get(c.exercise_id) ?? 0) + 1);
  return counts;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} u ${m} min` : `${h} uur`;
}
