// Maakt alle app-iconen in assets/ opnieuw: node scripts/make-icons.js (gebruikt Playwright + Chromium).
/* global __dirname, Buffer */
const { chromium } = require('playwright');
// Twee spraakwolkjes die elkaar overlappen: twee stemmen, één klank.
const left = 'M300 300 h250 a110 110 0 0 1 110 110 v120 a110 110 0 0 1 -110 110 h-150 l-90 80 v-80 h-10 a110 110 0 0 1 -110 -110 v-120 a110 110 0 0 1 110 -110 z';
const right = 'M474 400 h250 a110 110 0 0 1 110 110 v120 a110 110 0 0 1 -110 110 h-10 v80 l-90 -80 h-150 a110 110 0 0 1 -110 -110 v-120 a110 110 0 0 1 110 -110 z';
function svg({ bg, a, b, mid, size = 1024, scale = 1, mono = false }) {
  const t = `translate(${512 - 512 * scale} ${512 - 512 * scale}) scale(${scale}) translate(0 -48)`;
  const shapes = mono
    ? `<g transform="${t}"><path d="${left}" fill="#000"/><path d="${right}" fill="#000"/></g>`
    : `<defs><clipPath id="c"><path d="${left}"/></clipPath></defs>
       <g transform="${t}"><path d="${left}" fill="${a}"/><path d="${right}" fill="${b}"/>
       <path d="${right}" fill="${mid}" clip-path="url(#c)"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${shapes}</svg>`;
}
const C = { bg: '#FBF6F0', a: '#A84B26', b: '#4F6B55', mid: '#E9B872' };
const out = process.argv[2] || require('path').join(__dirname, '..', 'assets');
const jobs = [
  ['icon.png', svg({ ...C, scale: 1 }), 1024, false],
  ['splash-icon.png', svg({ ...C, bg: null, scale: 1 }), 1024, true],
  ['android-icon-foreground.png', svg({ ...C, bg: null, scale: 0.84 }), 512, true],
  ['android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${C.bg}"/></svg>`, 512, false],
  ['android-icon-monochrome.png', svg({ mono: true, scale: 0.84 }), 432, true],
  ['favicon.png', svg({ ...C, scale: 1 }), 48, false],
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, s, px, transparent] of jobs) {
    await page.setViewportSize({ width: px, height: px });
    await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}" width="${px}" height="${px}" style="display:block"></body></html>`);
    await page.screenshot({ path: `${out}/${name}`, omitBackground: transparent });
  }
  await browser.close();
})();
