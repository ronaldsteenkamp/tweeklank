import { anniversaryToday, buildOurYear, yearPeriod } from '../src/lib/ourYear';
import type { ArchiveDay } from '../src/lib/types';

const reaction = (user: string, emoji: string) => ({ id: 1, answer_id: 1, user_id: user, emoji, message: null, created_at: '' });
const answer = (user: string, body: string, reactions: ReturnType<typeof reaction>[] = []) => ({
  id: 1, user_id: user, day: '', body, created_at: '', updated_at: '', answer_reactions: reactions,
});
const day = (d: string, answers: ReturnType<typeof answer>[]): ArchiveDay => ({ day: d, daily_questions: { text: `Vraag ${d}`, depth: 1 }, daily_answers: answers });

describe('ons jaar', () => {
  it('kiest het lopende jaar, of het jaar dat net af is', () => {
    expect(yearPeriod('2026-10-21', '2026-12-01')).toMatchObject({ start: '2026-10-21', end: '2026-12-01', complete: false, label: 'Jullie eerste jaar tot nu' });
    expect(yearPeriod('2025-10-21', '2026-10-21')).toMatchObject({ start: '2025-10-21', end: '2026-10-20', complete: true, label: 'Jullie jaar 1' });
    expect(yearPeriod('2025-10-21', '2026-12-01')).toMatchObject({ start: '2026-10-21', complete: false, label: 'Jullie jaar 2 tot nu' });
  });

  it('herkent de verjaardag van de koppeling, ook op 29 februari', () => {
    expect(anniversaryToday('2025-10-21', '2026-10-21')).toBe(1);
    expect(anniversaryToday('2025-10-21', '2026-10-22')).toBe(0);
    expect(anniversaryToday('2026-10-21', '2026-10-21')).toBe(0);
    expect(anniversaryToday('2024-02-29', '2025-02-28')).toBe(1);
  });

  it('maakt het overzicht zonder partners te vergelijken', () => {
    const y = buildOurYear({
      period: { start: '2026-01-01', end: '2026-12-31' },
      meId: 'me',
      archive: [
        day('2026-03-01', [answer('me', 'a', [reaction('p', '❤️')]), answer('p', 'b', [reaction('me', '❤️')])]),
        day('2026-03-02', [answer('me', 'c', [reaction('p', '😂')]), answer('p', 'd', [reaction('me', '❤️')])]),
        day('2026-03-03', [answer('me', 'alleen ik')]),
        day('2025-12-31', [answer('me', 'x'), answer('p', 'y')]),
      ],
      plans: [
        { id: 1, title: 'Naar zee', notes: null, planned_for: null, done: true, created_at: '2026-05-01T10:00:00Z', created_by: 'me' },
        { id: 2, title: 'Nog doen', notes: null, planned_for: null, done: false, created_at: '2026-05-01T10:00:00Z', created_by: 'me' },
      ],
      quizzes: [
        { title: 'Eten', question_count: 10, my_score: 8, partner_score: 9 },
        { title: 'Dromen', question_count: 10, my_score: 10, partner_score: 4 },
        { title: 'Half', question_count: 10, my_score: 10, partner_score: null },
      ],
      favorites: ['Kaart'],
    });
    expect(y.togetherDays).toBe(2);
    expect(y.heartDays.map((d) => d.day)).toEqual(['2026-03-01']);
    expect(y.heartDays[0].answers[0]).toEqual({ mine: true, body: 'a' });
    expect(y.donePlans).toEqual(['Naar zee']);
    expect(y.bestQuiz).toEqual({ title: 'Eten', correct: 17, total: 20 });
    expect(y.favorites).toEqual(['Kaart']);
  });
});
