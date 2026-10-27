/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { depthDistribution, genderedWords, nearDuplicates, parseContent, similarity, splitTuple } from '../scripts/content-rules';

const migrations = () => {
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
};

describe('contentcheck', () => {
  it('splitst een SQL-rij in waarden', () => {
    expect(splitTuple("'dv-001', 1,  1, 'Wat is ''thuis''?'")).toEqual(['dv-001', 1, 1, "Wat is 'thuis'?"]);
    expect(splitTuple("'ex-a', '[\"x\", \"y\"]'::jsonb, true, null")).toEqual(['ex-a', '["x", "y"]', true, null]);
  });

  it('leest inserts en past updates toe', () => {
    const content = parseContent([
      "insert into public.daily_questions (slug, position, depth, text) values\n  ('dv-001', 1, 2, 'Oud?')\non conflict (slug) do nothing;",
      "update public.daily_questions set text = 'Nieuw, met ''aanhalingstekens''?' where slug = 'dv-001';",
    ]);
    expect(content.daily_questions['dv-001']).toEqual({ slug: 'dv-001', position: 1, depth: 2, text: "Nieuw, met 'aanhalingstekens'?" });
  });

  it('leest ook de vorm insert … select … from (values …) as v(…)', () => {
    const content = parseContent([
      "insert into public.theme_questions (slug, theme_id, position, depth, text)\nselect v.slug, t.id, v.position, v.depth, v.text\nfrom (values\n  ('th-a-01', 'th-a', 1, 3, 'Vraag?')\n) as v(slug, theme_slug, position, depth, text)\njoin public.themes t on t.slug = v.theme_slug\non conflict (slug) do nothing;",
    ]);
    expect(content.theme_questions['th-a-01']).toMatchObject({ theme_slug: 'th-a', depth: 3, text: 'Vraag?' });
  });

  it('weigert een update van een onbekende slug', () => {
    expect(() => parseContent(["update public.exercises set why = 'x' where slug = 'ex-bestaat-niet';"])).toThrow();
  });

  it('vindt gegenderde woorden, alleen als heel woord', () => {
    expect(genderedWords('Vertel wat hem of haar bezighoudt')).toEqual(['hem of haar']);
    expect(genderedWords('Weet je wat hij of zij wil?')).toEqual(['hij of zij']);
    expect(genderedWords('Je vriendin of je man')).toEqual(['vriendin', 'man']);
    expect(genderedWords('Vrouw')).toEqual(['vrouw']);
    expect(genderedWords('Een manier om met vrienden en vriendschap om te gaan')).toEqual([]);
    expect(genderedWords('Wat vindt je partner, of de ander?')).toEqual([]);
  });

  it('herkent (bijna) dubbele vragen, maar niet vragen over een ander onderwerp', () => {
    expect(similarity('Welk liedje brengt je terug naar een zomer?', 'Welk liedje brengt jou terug naar die ene zomer?')).toBeGreaterThanOrEqual(0.5);
    expect(similarity('Welk seizoen past bij jou?', 'Wat eet je als je jezelf wilt troosten?')).toBe(0);
    const pairs = nearDuplicates([
      { slug: 'a', text: 'Wat is jouw favoriete geur?' },
      { slug: 'b', text: 'Wat is je favoriete geur, en waarom?' },
      { slug: 'c', text: 'Welk dier zou je willen zijn?' },
    ]);
    expect(pairs.map(([x, y]) => `${x}-${y}`)).toEqual(['a-b']);
  });

  it('bewaakt de diepgangsverdeling 45/35/20', () => {
    const portion = (l: number, p: number, d: number) => [...Array(l).fill(1), ...Array(p).fill(2), ...Array(d).fill(3)];
    expect(depthDistribution(portion(27, 21, 12)).ok).toBe(true);
    expect(depthDistribution(portion(30, 18, 12)).ok).toBe(true); // 50/30/20: precies op de grens
    expect(depthDistribution(portion(40, 10, 10)).problems).toEqual([1, 2]);
    expect(depthDistribution([]).ok).toBe(false);
  });

  it('de content in de migraties voldoet aan alle regels', () => {
    const content = parseContent(migrations());
    const daily = Object.values(content.daily_questions);
    const regular = daily.filter((q) => q.slug.startsWith('dv-'));
    expect(regular.length).toBe(365);
    expect(nearDuplicates(daily.map((q) => ({ slug: q.slug, text: String(q.text) })))).toEqual([]);
    expect(depthDistribution(regular.map((q) => Number(q.depth))).ok).toBe(true);
    expect(Object.keys(content.question_series)).toHaveLength(6);
    const sources = Object.values(content.exercises).map((e) => String(e.source));
    expect(sources).toHaveLength(12);
    for (const src of sources) expect(src).toMatch(/^Geïnspireerd op .+/);
    expect(sources.join(' ')).not.toMatch(/bewezen/i);
    for (const rows of Object.values(content)) {
      for (const row of Object.values(rows)) {
        for (const value of Object.values(row)) if (typeof value === 'string') expect(genderedWords(value)).toEqual([]);
      }
    }
  });
});
