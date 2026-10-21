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

const expectations = [
  ['dagelijkse vragen', 'dv-', 60],
];

let ok = true;
for (const [label, prefix, min] of expectations) {
  const n = count(prefix);
  const pass = n >= min;
  ok &&= pass;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${n} (minimaal ${min})`);
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
