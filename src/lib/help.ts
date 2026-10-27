// Inhoud van de hulppagina "Als het niet goed gaat". Statisch: er wordt niets opgeslagen of doorgestuurd.
// Gegevens gecontroleerd op 27 oktober 2026 (zie de README, onder "Hulppagina").
// Getest in __tests__/help.test.ts

export type HelpAction = { label: string; url: string; a11y: string };
export type HelpContact = { name: string; body: string; actions: HelpAction[] };

export const EMERGENCY: HelpAction = { label: 'Bel 112', url: 'tel:112', a11y: 'Bel 112, het alarmnummer' };

export const SIGNALS: string[] = [
  'Je bent bang voor hoe je partner reageert, en je past je daarop aan.',
  'Je partner bepaalt over je geld, je telefoon of met wie je contact hebt.',
  'Je partner doet je lichamelijk pijn, of dwingt je tot seks of seksuele handelingen.',
];

export const CONTACTS: HelpContact[] = [
  {
    name: 'Veilig Thuis',
    body: 'Advies en hulp bij huiselijk geweld, ook als je je zorgen maakt om een ander. Gratis, dag en nacht bereikbaar, en je mag anoniem blijven.',
    actions: [
      { label: 'Bel 0800-2000', url: 'tel:08002000', a11y: 'Bel Veilig Thuis, 0800 2000' },
      { label: 'veiligthuis.nl', url: 'https://www.veiligthuis.nl', a11y: 'Open de website van Veilig Thuis' },
    ],
  },
  {
    name: '113 Zelfmoordpreventie',
    body: 'Denk je aan zelfmoord, of maak je je zorgen om iemand? Praat er anoniem over, via de telefoon of de chat.',
    actions: [
      { label: 'Bel 113', url: 'tel:113', a11y: 'Bel 113 Zelfmoordpreventie' },
      { label: 'Bel gratis 0800-0113', url: 'tel:08000113', a11y: 'Bel 113 Zelfmoordpreventie gratis, 0800 0113' },
      { label: 'Chat via 113.nl', url: 'https://www.113.nl', a11y: 'Open de website van 113 om te chatten' },
    ],
  },
  {
    name: 'Fier',
    body: 'Hulp bij geweld in afhankelijkheidsrelaties, zoals huiselijk en seksueel geweld. Je kunt ook anoniem contact opnemen.',
    actions: [
      { label: 'Bel 088-2080000', url: 'tel:0882080000', a11y: 'Bel Fier, 088 208 0000' },
      { label: 'fier.nl', url: 'https://www.fier.nl', a11y: 'Open de website van Fier' },
    ],
  },
  {
    name: 'Je huisarts of POH-GGZ',
    body: 'Bij stress, somberheid of problemen in je relatie kun je bij je huisarts terecht. Veel praktijken hebben een praktijkondersteuner GGZ (POH-GGZ) voor een paar gesprekken.',
    actions: [],
  },
  {
    name: 'Een relatietherapeut',
    body: 'Willen jullie samen met een professional praten? Zoek een geregistreerde relatie- of gezinstherapeut, bijvoorbeeld via de NVRG. Vraag vooraf wat het kost.',
    actions: [{ label: 'nvrg.nl', url: 'https://www.nvrg.nl', a11y: 'Open de website van de NVRG om een therapeut te zoeken' }],
  },
];
