import { CONTACTS, EMERGENCY, SIGNALS } from '../src/lib/help';

const allActions = [EMERGENCY, ...CONTACTS.flatMap((c) => c.actions)];

describe('hulppagina', () => {
  it('heeft drie signalen', () => {
    expect(SIGNALS).toHaveLength(3);
  });

  it('verwijst naar de afgesproken organisaties', () => {
    expect(CONTACTS.map((c) => c.name)).toEqual([
      'Veilig Thuis',
      '113 Zelfmoordpreventie',
      'Fier',
      'Je huisarts of POH-GGZ',
      'Een relatietherapeut',
    ]);
    expect(EMERGENCY.url).toBe('tel:112');
  });

  it('gebruikt alleen tel:-nummers met cijfers en https-links', () => {
    for (const a of allActions) expect(a.url).toMatch(/^(tel:\d{3,11}|https:\/\/www\.[a-z0-9.]+\.nl)$/);
  });

  it('heeft voor elke actie een schermlezerlabel', () => {
    for (const a of allActions) expect(a.a11y.length).toBeGreaterThan(a.label.length - 1);
  });

  it('het nummer in de knop is hetzelfde als het nummer dat gebeld wordt', () => {
    for (const a of allActions.filter((x) => x.url.startsWith('tel:'))) {
      expect(a.label.replace(/\D/g, '').endsWith(a.url.slice(4))).toBe(true);
    }
  });
});
