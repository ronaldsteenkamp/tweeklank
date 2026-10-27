import { isSeriesFinale, offerStatus, seriesLabel, type SeriesOffer } from '../src/lib/series';

const offer = (id: number, title: string, patch: Partial<SeriesOffer> = {}): SeriesOffer => ({
  series_id: id,
  slug: `tw-${id}`,
  title,
  intro: '',
  i_chose: false,
  partner_chose: false,
  ...patch,
});

describe('themaweken', () => {
  it('toont de voortgang', () => {
    expect(seriesLabel('Geld en wij', 3)).toBe('Themaweek Geld en wij · dag 3 van 7');
  });

  it('zegt wie wat koos, zonder druk', () => {
    expect(offerStatus([offer(1, 'Geld en wij'), offer(2, 'Op afstand')], 'Sam')).toBeNull();
    expect(offerStatus([offer(1, 'Geld en wij', { i_chose: true }), offer(2, 'Op afstand')], 'Sam')).toBe(
      'Je koos Geld en wij. Wacht op Sam.',
    );
    expect(offerStatus([offer(1, 'Geld en wij', { partner_chose: true })], 'Sam')).toMatch(/^Sam koos Geld en wij/);
    expect(
      offerStatus([offer(1, 'Geld en wij', { i_chose: true }), offer(2, 'Op afstand', { partner_chose: true })], 'Sam'),
    ).toMatch(/Kies dezelfde/);
  });

  it('herkent de laatste dag met oefening', () => {
    expect(isSeriesFinale(7, 'ex-herstel')).toBe(true);
    expect(isSeriesFinale(6, 'ex-herstel')).toBe(false);
    expect(isSeriesFinale(null, null)).toBe(false);
  });
});
