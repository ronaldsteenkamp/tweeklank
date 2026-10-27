import { buildExport, exportFileName, exportHtml } from '../src/lib/export';
import type { ArchiveDay } from '../src/lib/types';

const answer = (id: number, user: string, body: string) => ({
  id,
  user_id: user,
  day: '',
  body,
  created_at: `2026-10-0${id}T10:00:00Z`,
  updated_at: '',
  answer_reactions: [] as ArchiveDay['daily_answers'][number]['answer_reactions'],
});

const archive: ArchiveDay[] = [
  { day: '2026-10-02', daily_questions: { text: 'Alleen de partner?', depth: 1 }, daily_answers: [answer(2, 'p', 'geheim')] },
  {
    day: '2026-10-01',
    daily_questions: { text: 'Allebei?', depth: 1 },
    daily_answers: [
      answer(1, 'me', 'van mij'),
      {
        ...answer(3, 'p', 'van de ander <b>'),
        answer_reactions: [{ id: 1, answer_id: 3, user_id: 'me', emoji: '❤️', message: 'mooi', created_at: '2026-10-01T11:00:00Z' }],
      },
    ],
  },
  { day: '2026-10-03', daily_questions: { text: 'Alleen ik?', depth: 1 }, daily_answers: [answer(4, 'me', 'alleen ik')] },
];

const data = buildExport({
  meId: 'me',
  myName: 'Robin',
  partnerName: 'Sam',
  archive,
  plans: [{ id: 1, title: 'Naar zee', notes: null, planned_for: '2026-11-01', done: true, created_at: '2026-10-01', created_by: 'me' }],
  dates: [{ id: 1, title: 'Jubileum', kind: 'jubileum', date: '2020-05-01', yearly: true, remind_days_before: 1, created_by: 'p' }],
  now: new Date('2026-10-27T12:00:00Z'),
});

describe('export', () => {
  it('bevat je eigen antwoorden en die van je partner alleen op dagen dat jullie allebei antwoordden', () => {
    expect(data.dagvragen.map((d) => d.dag)).toEqual(['2026-10-01', '2026-10-03']);
    expect(data.dagvragen[0].antwoorden.map((a) => a.van)).toEqual(['Robin', 'Sam']);
    expect(JSON.stringify(data)).not.toContain('geheim');
  });

  it('bevat reacties, plannen en datums', () => {
    expect(data.dagvragen[0].antwoorden[1].reacties).toEqual([{ van: 'Robin', emoji: '❤️', bericht: 'mooi', op: '2026-10-01T11:00:00Z' }]);
    expect(data.plannen[0]).toMatchObject({ titel: 'Naar zee', afgevinkt: true });
    expect(data.datums[0]).toMatchObject({ titel: 'Jubileum', jaarlijks: true });
  });

  it('maakt leesbare HTML zonder dat tekst als HTML wordt uitgevoerd', () => {
    const html = exportHtml(data);
    expect(html).toContain('van de ander &lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('Robin reageerde: ❤️ mooi');
    expect(html).toContain('✓ Naar zee');
  });

  it('geeft het bestand een herkenbare naam', () => {
    expect(exportFileName('json', '2026-10-27')).toBe('tweeklank-export-2026-10-27.json');
  });
});
