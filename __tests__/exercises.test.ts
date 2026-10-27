import { completionCounts, filterExercises, minutesLabel, type Completion, type Exercise } from '../src/lib/exercises';

const ex = (id: number, category: Exercise['category']): Exercise => ({
  id,
  slug: `ex-${id}`,
  position: id,
  title: `Oefening ${id}`,
  category,
  minutes: 10,
  intro: '',
  steps: ['a', 'b'],
  why: '',
  source: null,
});

describe('oefeningen', () => {
  const list = [ex(2, 'conflict'), ex(1, 'waardering'), ex(3, 'conflict')];

  it('sorteert en filtert op categorie', () => {
    expect(filterExercises(list, null).map((e) => e.id)).toEqual([1, 2, 3]);
    expect(filterExercises(list, 'conflict').map((e) => e.id)).toEqual([2, 3]);
    expect(filterExercises(list, 'verbinding')).toEqual([]);
  });

  it('telt hoe vaak een oefening is gedaan', () => {
    const c = (exercise_id: number): Completion => ({ id: 0, exercise_id, user_id: 'u', completed_at: '', note: null });
    const counts = completionCounts([c(1), c(1), c(3)]);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(3)).toBe(1);
    expect(counts.get(2)).toBeUndefined();
  });

  it('toont de duur leesbaar', () => {
    expect(minutesLabel(5)).toBe('5 min');
    expect(minutesLabel(60)).toBe('1 uur');
    expect(minutesLabel(90)).toBe('1 u 30 min');
  });
});
