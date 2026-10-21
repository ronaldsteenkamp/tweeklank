// Controleert de startcontent in de migraties: aantallen en dubbele slugs.
// Gebruik: npm run check:content
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

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

process.exit(ok ? 0 : 1);
