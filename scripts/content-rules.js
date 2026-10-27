// Regels voor de content in de migraties: inlezen, dubbele vragen, gegenderde woorden en de
// diepgangsverdeling. Gebruikt door scripts/check-content.mjs, getest in __tests__/contentRules.test.ts.
// Bewust CommonJS zonder afhankelijkheden, zodat het in Node én in Jest draait.

/** Splitst een SQL-tuple (zonder haakjes) in waarden: 'tekst' (met '' als escape), getallen, true/false/null. */
function splitTuple(src) {
  const values = [];
  let i = 0;
  while (i < src.length) {
    while (src[i] === ' ' || src[i] === ',') i++;
    if (i >= src.length) break;
    if (src[i] === "'") {
      let out = '';
      i++;
      while (i < src.length) {
        if (src[i] === "'" && src[i + 1] === "'") {
          out += "'";
          i += 2;
        } else if (src[i] === "'") {
          i++;
          break;
        } else out += src[i++];
      }
      // een cast zoals ::jsonb overslaan
      while (i < src.length && src[i] !== ',') i++;
      values.push(out);
    } else {
      let raw = '';
      while (i < src.length && src[i] !== ',') raw += src[i++];
      raw = raw.trim();
      values.push(raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : Number(raw));
    }
  }
  return values;
}

const splitCols = (s) => s.split(',').map((c) => c.trim());

/**
 * Leest alle content-rijen (één rij per regel, met slug als eerste waarde) en past daarna de
 * `update public.x set kolom = '…' where slug = '…';`-regels toe. Geeft { tabel: { slug: rij } }.
 */
function parseContent(sqlFiles) {
  const tables = {};
  const put = (table, row) => {
    tables[table] ??= {};
    tables[table][row.slug] = { ...(tables[table][row.slug] ?? {}), ...row };
  };

  for (const sql of sqlFiles) {
    let block = null;
    const flush = () => {
      if (block?.cols) {
        for (const values of block.rows) {
          const row = {};
          block.cols.forEach((c, i) => (row[c] = values[i]));
          if (typeof row.slug === 'string') put(block.table, row);
        }
      }
      block = null;
    };

    for (const line of sql.split('\n')) {
      const insert = line.match(/^insert into public\.(\w+) \(([^)]+)\)/);
      if (insert) {
        flush();
        // "insert … values" gebruikt deze kolommen; "insert … select … from (values …) as v(…)" overschrijft ze
        block = { table: insert[1], cols: splitCols(insert[2]), rows: [] };
        continue;
      }
      const alias = line.match(/^\) as v\(([^)]+)\)/);
      if (alias && block) {
        block.cols = splitCols(alias[1]);
        continue;
      }
      const row = line.match(/^\s+\((\s*'[a-z0-9-]+'.*)\),?$/);
      if (row && block) {
        block.rows.push(splitTuple(row[1]));
        continue;
      }
      if (block && /on conflict|;\s*$/.test(line)) flush();

      const update = line.match(/^update public\.(\w+) set (\w+) = ('(?:[^']|'')*')(?:::\w+)? where slug = '([a-z0-9-]+)';$/);
      if (update) {
        const [, table, col, literal, slug] = update;
        if (!tables[table]?.[slug]) throw new Error(`update van onbekende slug ${slug} in ${table}`);
        put(table, { slug, [col]: splitTuple(literal)[0] });
      }
    }
    flush();
  }
  return tables;
}

// ---------- Gegenderde woorden ----------

const GENDERED = [
  'hij of zij',
  'zij of hij',
  'hem of haar',
  'haar of hem',
  'zijn of haar',
  'haar of zijn',
  'hij/zij',
  'zij/hij',
  'hem/haar',
  'zijn/haar',
  'vriendin',
  'vriend',
  'man',
  'vrouw',
  'echtgenoot',
  'echtgenote',
];

/** Gegenderde woorden in een tekst (hele woorden, hoofdletterongevoelig). */
function genderedWords(text) {
  const lower = String(text).toLowerCase();
  return GENDERED.filter((w) => new RegExp(`(?<![\\p{L}])${w.replace('/', '\\/')}(?![\\p{L}])`, 'u').test(lower));
}

// ---------- (Bijna) dubbele vragen ----------

// Woorden die bijna in elke vraag staan en dus niets zeggen over het onderwerp
const STOPWORDS = new Set(
  (
    'de het een en of je jij jou jouw jezelf ik mij me mijn we wij ons onze jullie die dat dit deze wat welk welke wie ' +
    'waar waarom wanneer hoe als in op aan van voor met naar bij over om te tot uit door zou zouden zijn is was ben bent ' +
    'heb hebt heeft had hebben kun kan kunnen wil wilt willen moet doe doet doen er niet nog al ook juist echt graag ' +
    'meest vaakst liefst ooit nu iets eigenlijk even dan maar zo toch waarin waarover waarvoor wordt word zich'
  ).split(' '),
);

function contentWords(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Overlap tussen twee vragen (0–1), op basis van de inhoudswoorden (Jaccard). */
function similarity(a, b) {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (!wa.size || !wb.size) return 0;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both);
}

const SIMILARITY_LIMIT = 0.5;

/** Paren van vragen die (bijna) hetzelfde zijn: [slugA, slugB, score]. */
function nearDuplicates(items, limit = SIMILARITY_LIMIT) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = similarity(items[i].text, items[j].text);
      if (score >= limit) out.push([items[i].slug, items[j].slug, Math.round(score * 100) / 100]);
    }
  }
  return out;
}

// ---------- Diepgangsverdeling ----------

const DEPTH_TARGET = { 1: 0.45, 2: 0.35, 3: 0.2 };
const DEPTH_MARGIN = 0.05;

/** Controleert of de verdeling luchtig/persoonlijk/diep binnen 5 procentpunt van 45/35/20 ligt. */
function depthDistribution(depths) {
  const total = depths.length;
  const share = {};
  const problems = [];
  for (const d of [1, 2, 3]) {
    share[d] = total ? depths.filter((x) => Number(x) === d).length / total : 0;
    if (Math.abs(share[d] - DEPTH_TARGET[d]) > DEPTH_MARGIN + 1e-9) problems.push(d);
  }
  return { total, share, ok: total > 0 && problems.length === 0, problems };
}

module.exports = {
  splitTuple,
  parseContent,
  genderedWords,
  similarity,
  nearDuplicates,
  depthDistribution,
  SIMILARITY_LIMIT,
  DEPTH_TARGET,
};
