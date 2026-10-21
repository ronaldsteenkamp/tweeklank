import { nextStep, quizStatus, scoreMessage, summarize, type QuizResultRow } from '../src/lib/quiz';

const row = (p: number, my_self: number, partner_self: number, my_guess: number, partner_guess: number): QuizResultRow => ({
  question_id: p,
  position: p,
  prompt: `Vraag ${p}`,
  options: ['a', 'b', 'c', 'd'],
  my_self,
  partner_self,
  my_guess,
  partner_guess,
});

describe('quizuitslag', () => {
  const rows = [row(1, 0, 0, 0, 0), row(2, 1, 2, 2, 3), row(3, 3, 1, 0, 3)];

  it('telt goed geraden antwoorden van beide kanten', () => {
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.myScore).toBe(2); // vraag 1 en 2
    expect(s.partnerScore).toBe(2); // vraag 1 en 3
  });

  it('splitst overeenkomsten en verschillen', () => {
    const s = summarize(rows);
    expect(s.same.map((r) => r.position)).toEqual([1]);
    expect(s.different.map((r) => r.position)).toEqual([2, 3]);
  });

  it('geeft een passende boodschap', () => {
    expect(scoreMessage(10, 10)).toMatch(/Foutloos/);
    expect(scoreMessage(7, 10)).toMatch(/Sterk/);
    expect(scoreMessage(4, 10)).toMatch(/begin/);
    expect(scoreMessage(1, 10)).toMatch(/Verrassingen/);
  });
});

describe('voortgang', () => {
  const ids = [10, 11, 12];

  it('begint bij de eerste vraag over jezelf', () => {
    expect(nextStep(ids, [])).toEqual({ kind: 'self', index: 0 });
  });

  it('gaat na alle eigen antwoorden door met gokken', () => {
    const answered = ids.map((id) => ({ question_id: id, kind: 'self' as const }));
    expect(nextStep(ids, answered)).toEqual({ kind: 'guess', index: 0 });
    expect(nextStep(ids, [...answered, { question_id: 10, kind: 'guess' }])).toEqual({ kind: 'guess', index: 1 });
  });

  it('vult een overgeslagen vraag eerst aan', () => {
    expect(nextStep(ids, [{ question_id: 10, kind: 'self' }, { question_id: 12, kind: 'self' }])).toEqual({ kind: 'self', index: 1 });
  });

  it('is klaar als alles is ingevuld', () => {
    const all = ids.flatMap((id) => [
      { question_id: id, kind: 'self' as const },
      { question_id: id, kind: 'guess' as const },
    ]);
    expect(nextStep(ids, all)).toBeNull();
  });

  it('bepaalt de status voor de quizlijst', () => {
    expect(quizStatus(0, 10, false)).toBe('nieuw');
    expect(quizStatus(7, 10, true)).toBe('bezig');
    expect(quizStatus(20, 10, false)).toBe('wachten');
    expect(quizStatus(20, 10, true)).toBe('klaar');
  });
});
