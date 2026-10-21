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
