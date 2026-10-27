// Export van je gegevens (AVG art. 20): JSON en een eenvoudige, leesbare HTML-pagina.
// Wordt volledig op het toestel gemaakt. Getest in __tests__/export.test.ts
import type { ImportantDate, Plan } from './together';
import type { ArchiveDay } from './types';

type ExportReaction = { van: string; emoji: string | null; bericht: string | null; op: string };
type ExportAnswer = { van: string; tekst: string; geschreven_op: string; reacties: ExportReaction[] };

export type ExportData = {
  app: 'Tweeklank';
  gemaakt_op: string;
  ik: string;
  partner: string | null;
  dagvragen: { dag: string; vraag: string; antwoorden: ExportAnswer[] }[];
  plannen: { titel: string; notities: string | null; gepland_voor: string | null; afgevinkt: boolean; toegevoegd_op: string }[];
  datums: { titel: string; soort: string; datum: string; jaarlijks: boolean }[];
};

/**
 * Bouwt de export. Je eigen antwoorden altijd; die van je partner alleen op dagen waarop jullie
 * allebei hebben geantwoord (wat je in de app dus al kon zien).
 */
export function buildExport(params: {
  meId: string;
  myName: string;
  partnerName: string | null;
  archive: ArchiveDay[];
  plans: Plan[];
  dates: ImportantDate[];
  now?: Date;
}): ExportData {
  const who = (userId: string) => (userId === params.meId ? params.myName || 'Ik' : params.partnerName || 'Partner');
  return {
    app: 'Tweeklank',
    gemaakt_op: (params.now ?? new Date()).toISOString(),
    ik: params.myName,
    partner: params.partnerName,
    dagvragen: [...params.archive]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => {
        const answeredMyself = d.daily_answers.some((a) => a.user_id === params.meId);
        const visible = d.daily_answers.filter((a) => a.user_id === params.meId || answeredMyself);
        return {
          dag: d.day,
          vraag: d.daily_questions.text,
          antwoorden: visible
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((a) => ({
              van: who(a.user_id),
              tekst: a.body,
              geschreven_op: a.created_at,
              reacties: [...a.answer_reactions]
                .sort((x, y) => x.created_at.localeCompare(y.created_at))
                .map((r) => ({ van: who(r.user_id), emoji: r.emoji, bericht: r.message, op: r.created_at })),
            })),
        };
      })
      .filter((d) => d.antwoorden.length > 0),
    plannen: [...params.plans]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({ titel: p.title, notities: p.notes, gepland_voor: p.planned_for, afgevinkt: p.done, toegevoegd_op: p.created_at })),
    datums: [...params.dates]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ titel: d.title, soort: d.kind, datum: d.date, jaarlijks: d.yearly })),
  };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Een eenvoudige, leesbare HTML-pagina (ook te printen als PDF vanuit de browser). */
export function exportHtml(data: ExportData): string {
  const days = data.dagvragen
    .map(
      (d) => `<section><h3>${esc(d.dag)}: ${esc(d.vraag)}</h3>${d.antwoorden
        .map(
          (a) =>
            `<p><strong>${esc(a.van)}:</strong> ${esc(a.tekst)}</p>${a.reacties
              .map((r) => `<p class="r">${esc(r.van)} reageerde: ${esc([r.emoji, r.bericht].filter(Boolean).join(' '))}</p>`)
              .join('')}`,
        )
        .join('')}</section>`,
    )
    .join('\n');
  const plans = data.plannen
    .map((p) => `<li>${p.afgevinkt ? '✓ ' : ''}${esc(p.titel)}${p.gepland_voor ? ` (${esc(p.gepland_voor)})` : ''}${p.notities ? `: ${esc(p.notities)}` : ''}</li>`)
    .join('');
  const dates = data.datums.map((d) => `<li>${esc(d.datum)}: ${esc(d.titel)}${d.jaarlijks ? ' (elk jaar)' : ''}</li>`).join('');
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tweeklank: export</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px 16px;color:#2B2320;background:#FBF6F0}
h1{color:#A84B26}section{background:#fff;border:1px solid #E3D6C8;border-radius:12px;padding:12px 16px;margin:12px 0}
h3{margin:0 0 6px;font-size:17px}.r{color:#6B5D55;margin-left:16px}</style></head>
<body><h1>Tweeklank</h1>
<p>Export van ${esc(data.ik || 'jou')}${data.partner ? ` en ${esc(data.partner)}` : ''}, gemaakt op ${esc(data.gemaakt_op.slice(0, 10))}.</p>
<h2>Dagvragen</h2>
${days || '<p>Nog geen antwoorden.</p>'}
<h2>Plannen</h2><ul>${plans || '<li>Geen plannen.</li>'}</ul>
<h2>Belangrijke datums</h2><ul>${dates || '<li>Geen datums.</li>'}</ul>
</body></html>
`;
}

/** 'tweeklank-export-2026-10-27.json' */
export function exportFileName(ext: 'json' | 'html', day: string): string {
  return `tweeklank-export-${day}.${ext}`;
}
