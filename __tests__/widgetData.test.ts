import { widgetProps } from '../src/lib/widgetData';

const base = { partnerName: 'Sam', questionText: 'Welk liedje vat dit jaar samen?', showQuestion: false };

describe('thuisschermwidget', () => {
  it('meldt dat de vraag klaarstaat', () => {
    expect(widgetProps({ ...base, answered: false, partnerAnswered: false })).toEqual({
      status: 'Vraag van vandaag staat klaar',
      partnerLine: '',
      countdown: '',
      question: '',
    });
  });

  it('meldt dat je partner heeft geantwoord, zonder inhoud', () => {
    const p = widgetProps({ ...base, answered: false, partnerAnswered: true });
    expect(p.partnerLine).toBe('Sam heeft geantwoord');
    expect(JSON.stringify(p)).not.toContain('liedje');
  });

  it('meldt dat jullie allebei hebben geantwoord', () => {
    const p = widgetProps({ ...base, answered: true, partnerAnswered: true });
    expect(p.status).toBe('Jullie hebben allebei geantwoord');
    expect(p.partnerLine).toBe('');
  });

  it('toont de vraag alleen als je dat zelf aanzet', () => {
    expect(widgetProps({ ...base, answered: false, partnerAnswered: false }).question).toBe('');
    expect(widgetProps({ ...base, showQuestion: true, answered: false, partnerAnswered: false }).question).toBe(base.questionText);
  });

  it('kan aftellen naar het weerzien', () => {
    expect(widgetProps({ ...base, answered: true, partnerAnswered: false, countdown: 'Nog 3 dagen tot jullie elkaar weer zien' }).countdown).toMatch(
      /^Nog 3 dagen/,
    );
  });
});
