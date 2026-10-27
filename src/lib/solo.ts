// Solo-modus: tekst van de rustige kaart als je partner een tijdje niet antwoordt.
// Geïnspireerd op EFT (Sue Johnson): achtervolgen en terugtrekken, zonder schuld. Hoogstens 120 woorden.
// Getest in __tests__/solo.test.ts

export const SOLO_TITLE = 'Even alleen aan de beurt';

export const SOLO_PARAGRAPHS = [
  'Je kunt de vragen gewoon voor jezelf blijven beantwoorden. Je partner ziet je antwoorden zodra die ook antwoordt. De vraag van gisteren kan nog tot het einde van vandaag.',
  'Niet iedereen heeft even veel behoefte aan nabijheid, en dat wisselt per periode. Vaak zoekt de een dan meer contact en neemt de ander wat afstand. Hoe meer de een trekt, hoe meer de ander zich kan terugtrekken. Dat is niemands schuld. Het is een patroon dat veel koppels kennen.',
];

export const SOLO_OPENER_INTRO = 'Wil je het erover hebben? Probeer het eens buiten de app, bijvoorbeeld zo:';
export const SOLO_OPENER = 'Ik mis onze vragen een beetje. Hoe is dat voor jou?';
export const SOLO_SOURCE = 'Geïnspireerd op Emotionally Focused Therapy (EFT) van Sue Johnson.';

export function wordCount(texts: string[]): number {
  return texts.join(' ').split(/\s+/).filter(Boolean).length;
}
