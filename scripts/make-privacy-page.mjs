// Maakt docs/index.html (de privacyverklaring voor de App Store en Play Store) uit src/app/privacy.tsx,
// zodat de app en de website altijd dezelfde tekst hebben. Draai: node scripts/make-privacy-page.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/privacy.tsx'), 'utf8');
const items = [...src.matchAll(/\['([^']+)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]);
if (items.length === 0) throw new Error('Geen privacy-items gevonden in src/app/privacy.tsx');

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sections = items.map(([title, body]) => `    <section>\n      <h2>${esc(title)}</h2>\n      <p>${esc(body)}</p>\n    </section>`).join('\n');

const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tweeklank – Privacy</title>
  <style>
    :root { --bg: #FBF6F0; --surface: #FFFFFF; --text: #2B2320; --muted: #6B5D55; --primary: #A84B26; --border: #E3D6C8; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #1C1714; --surface: #27201C; --text: #F3EBE3; --muted: #BBAEA4; --primary: #E8916B; --border: #46392F; }
    }
    body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.55 system-ui, -apple-system, sans-serif; }
    main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
    h1 { color: var(--primary); font-size: 34px; margin: 0 0 4px; }
    .lead { color: var(--muted); margin: 0 0 24px; }
    section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; margin-bottom: 12px; }
    h2 { font-size: 20px; margin: 0 0 6px; }
    p { margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>Tweeklank</h1>
    <p class="lead">Privacyverklaring. Tweeklank is helemaal gratis: geen abonnement, geen advertenties en geen tracking.</p>
${sections}
  </main>
</body>
</html>
`;

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs/index.html'), html);
console.log(`docs/index.html geschreven (${items.length} onderdelen)`);
