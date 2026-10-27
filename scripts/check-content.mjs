// Controleert de content in de migraties: aantallen, dubbele slugs en vragen, gegenderde woorden
// en de diepgangsverdeling van de dagvragen. Gebruik: npm run check:content
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import rules from './content-rules.js';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'));
const sql = files.join('\n');

const slugs = [...sql.matchAll(/\(\s*'([a-z0-9-]+)'\s*,/g)].map((m) => m[1]);
const count = (prefix) => slugs.filter((s) => s.startsWith(prefix)).length;

const quizSlugs = slugs.filter((s) => /^qz-[a-z]+$/.test(s));
const quizQuestionsPer = (quiz) => slugs.filter((s) => new RegExp(`^${quiz}-\\d{2}$`).test(s)).length;

const expectations = [
  ['dagelijkse vragen', count('dv-'), 60],
  ['quizzen', quizSlugs.length, 5],
  ['oefeningen', count('ex-'), 12],
  ['date-ideeën', count('di-'), 40],
  ...quizSlugs.map((q) => [`  vragen in ${q}`, quizQuestionsPer(q), 10]),
];

let ok = true;
for (const [label, n, min] of expectations) {
  const pass = n >= min;
  ok &&= pass;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${n} (minimaal ${min})`);
}

// Quizvragen: elke vraag 3-4 unieke opties, en geen dubbele vragen
const quizRows = [...sql.matchAll(/\('(qz-[a-z]+-\d{2})', '[^']+', \d+, '((?:[^']|'')+)', '(\[.*?\])'\)/g)];
for (const [, slug, , opts] of quizRows) {
  const options = JSON.parse(opts.replace(/''/g, "'"));
  if (options.length < 3 || options.length > 4 || new Set(options).size !== options.length) {
    ok = false;
    console.log(`✗ ${slug}: opties ongeldig of dubbel`);
  }
}
const prompts = quizRows.map((m) => m[2].toLowerCase());
const dupPrompts = prompts.filter((t, i) => prompts.indexOf(t) !== i);
if (dupPrompts.length) {
  ok = false;
  console.log(`✗ dubbele quizvragen: ${dupPrompts.join(' | ')}`);
} else {
  console.log(`✓ quizopties en -vragen in orde (${quizRows.length} gecontroleerd)`);
}

// Gesprekskaarten: 8 gewone thema's + 18+-set, elk 15 vragen met alle drie de diepgangen
const themeRows = [...sql.matchAll(/\('(th-[a-z]+)', \d+, '(?:[^']|'')+', '(?:[^']|'')+', '[a-z-]+', (true|false)\)/g)];
const cardRows = [...sql.matchAll(/\('(th-[a-z]+)-\d{2}', '(th-[a-z]+)', \d+, ([123]), '((?:[^']|'')+)'\)/g)];
const regularThemes = themeRows.filter((m) => m[2] === 'false').map((m) => m[1]);
const explicitThemes = themeRows.filter((m) => m[2] === 'true').map((m) => m[1]);
const themeChecks = [
  ["gewone thema's", regularThemes.length, 8],
  ['18+-thema', explicitThemes.length, 1],
  ...[...regularThemes, ...explicitThemes].map((t) => [`  kaarten in ${t}`, cardRows.filter((m) => m[2] === t).length, 15]),
];
for (const [label, n, min] of themeChecks) {
  const pass = n >= min;
  ok &&= pass;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${n} (minimaal ${min})`);
}
for (const t of [...regularThemes, ...explicitThemes]) {
  const depths = new Set(cardRows.filter((m) => m[2] === t).map((m) => m[3]));
  if (depths.size !== 3) {
    ok = false;
    console.log(`✗ ${t}: niet alle diepgangen (luchtig/persoonlijk/diep) aanwezig`);
  }
}
const cardTexts = cardRows.map((m) => m[4].toLowerCase());
const dupCards = cardTexts.filter((t, i) => cardTexts.indexOf(t) !== i);
if (dupCards.length) {
  ok = false;
  console.log(`✗ dubbele kaarten: ${dupCards.join(' | ')}`);
} else {
  console.log(`✓ geen dubbele kaarten, alle diepgangen aanwezig (${cardRows.length} gecontroleerd)`);
}

const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (dupes.length) {
  ok = false;
  console.log(`✗ dubbele slugs: ${[...new Set(dupes)].join(', ')}`);
} else {
  console.log('✓ geen dubbele slugs');
}

// Dubbele vraagteksten opsporen
const texts = [...sql.matchAll(/,\s*\d+\s*,\s*\d\s*,\s*'((?:[^']|'')+)'\)/g)].map((m) => m[1].toLowerCase());
const dupTexts = texts.filter((t, i) => texts.indexOf(t) !== i);
if (dupTexts.length) {
  ok = false;
  console.log(`✗ dubbele vragen: ${dupTexts.join(' | ')}`);
} else {
  console.log(`✓ geen dubbele vraagteksten (${texts.length} gecontroleerd)`);
}

// ---- Regels op de content zoals die na alle migraties (inclusief updates) in de database staat ----
const content = rules.parseContent(files);

// Gegenderde woorden: in alle teksten van alle contenttabellen
const gendered = [];
for (const [table, rows] of Object.entries(content)) {
  for (const row of Object.values(rows)) {
    for (const [col, value] of Object.entries(row)) {
      if (typeof value !== 'string' || col === 'slug') continue;
      const found = rules.genderedWords(value);
      if (found.length) gendered.push(`${table}.${row.slug}.${col}: ${found.join(', ')}`);
    }
  }
}
if (gendered.length) {
  ok = false;
  console.log(`✗ gegenderde woorden (schrijf "je partner" of "de ander"):\n  ${gendered.join('\n  ')}`);
} else {
  console.log('✓ geen gegenderde woorden in de content');
}

// Dezelfde regel voor de teksten in de app zelf (src/)
const srcDir = join(import.meta.dirname, '..', 'src');
const uiHits = readdirSync(srcDir, { recursive: true })
  .filter((f) => /\.tsx?$/.test(f))
  .flatMap((f) =>
    readFileSync(join(srcDir, f), 'utf8')
      .split('\n')
      .flatMap((line, i) => rules.genderedWords(line).map((w) => `src/${f}:${i + 1}: ${w}`)),
  );
if (uiHits.length) {
  ok = false;
  console.log(`✗ gegenderde woorden in de app:\n  ${uiHits.join('\n  ')}`);
} else {
  console.log('✓ geen gegenderde woorden in de app-teksten');
}

// (Bijna) dubbele dagvragen, ook tegen de bestaande
const allDaily = Object.values(content.daily_questions ?? {}).sort((a, b) => a.position - b.position);
// gewone dagvragen (dv-…); de vragen van themaweken (tw-…) tellen niet mee voor de diepgangsverdeling
const daily = allDaily.filter((q) => q.slug.startsWith('dv-'));
const near = rules.nearDuplicates(allDaily.map((q) => ({ slug: q.slug, text: q.text })));
if (near.length) {
  ok = false;
  console.log(`✗ dagvragen die (bijna) hetzelfde zijn:\n  ${near.map(([a, b, s]) => `${a} ~ ${b} (${s})`).join('\n  ')}`);
} else {
  console.log(`✓ geen (bijna) dubbele dagvragen (${allDaily.length} gecontroleerd, inclusief themaweken)`);
}

// Themaweken: elke serie precies 7 vragen (stap 1 t/m 7), een intro en een afsluitende oefening
const seriesList = Object.values(content.question_series ?? {});
const badSeries = seriesList.filter((ser) => {
  const steps = allDaily.filter((q) => q.series_slug === ser.slug).map((q) => q.step).sort((a, b) => a - b);
  return steps.join(',') !== '1,2,3,4,5,6,7' || !ser.intro || !content.exercises?.[ser.exercise_slug];
});
const seriesPass = seriesList.length >= 6 && badSeries.length === 0;
ok &&= seriesPass;
console.log(
  `${seriesPass ? '✓' : '✗'} themaweken: ${seriesList.length} (minimaal 6)${badSeries.length ? `, niet in orde: ${badSeries.map((x) => x.slug).join(', ')}` : ', elk 7 vragen met intro en oefening'}`,
);

// Oefeningen: elke oefening een eerlijke onderbouwing, nooit "bewezen"
const exercises = Object.values(content.exercises ?? {});
const badSources = exercises.filter((e) => typeof e.source !== 'string' || !e.source.startsWith('Geïnspireerd op') || /bewezen/i.test(e.source));
if (badSources.length) {
  ok = false;
  console.log(`✗ oefeningen zonder (eerlijke) onderbouwing: ${badSources.map((e) => e.slug).join(', ')}`);
} else {
  console.log(`✓ alle oefeningen hebben een onderbouwing (${exercises.length} gecontroleerd)`);
}

// Diepgangsverdeling: in totaal en per portie van 60 (45% luchtig, 35% persoonlijk, 20% diep, ±5 punt)
const pct = (x) => `${Math.round(x * 100)}%`;
const portions = [['alle dagvragen', daily]];
for (let i = 0; i < daily.length; i += 60) {
  const part = daily.slice(i, i + 60);
  if (part.length === 60) portions.push([`dagvragen ${part[0].slug}–${part[59].slug}`, part]);
}
for (const [label, list] of portions) {
  const d = rules.depthDistribution(list.map((q) => q.depth));
  ok &&= d.ok;
  console.log(
    `${d.ok ? '✓' : '✗'} diepgang ${label}: ${pct(d.share[1])} luchtig, ${pct(d.share[2])} persoonlijk, ${pct(d.share[3])} diep (doel 45/35/20)`,
  );
}

process.exit(ok ? 0 : 1);
