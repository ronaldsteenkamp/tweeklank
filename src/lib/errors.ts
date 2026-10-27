// Vertaalt foutcodes uit de database-RPC's naar begrijpelijke Nederlandse meldingen.
// Volgorde telt: de eerste sleutel die in de foutmelding voorkomt, wint.
const MESSAGES: Record<string, string> = {
  overzetcode_onbekend: 'Deze overzetcode klopt niet of is verlopen. Maak op je oude telefoon een nieuwe.',
  niet_ingelogd: 'Je bent niet (meer) ingelogd. Log opnieuw in.',
  code_onbekend: 'Deze code kennen we niet. Controleer of je hem goed hebt overgenomen.',
  code_gebruikt: 'Deze code is al gebruikt. Vraag je partner om een nieuwe.',
  code_verlopen: 'Deze code is verlopen. Vraag je partner om een nieuwe.',
  eigen_code: 'Dit is je eigen code. Stuur hem naar je partner, die vult hem in.',
  al_gekoppeld: 'Je bent al gekoppeld aan een partner.',
  koppel_vol: 'Bij deze code hoort al een compleet koppel.',
  geen_partner: 'Koppel eerst je partner om de dagelijkse vraag te zien.',
  quiz_niet_klaar: 'De uitslag verschijnt zodra jullie allebei klaar zijn.',
  ongeldige_optie: 'Die keuze bestaat niet (meer). Kies een van de opties.',
  ongeldig_weekdoel: 'Kies een weekdoel van 3 tot en met 7 samen-dagen.',
  ongeldige_pauze: 'Kies een pauze van 1, 2 of 4 weken, of tot jullie hem uitzetten.',
  al_gepauzeerd: 'Jullie ritme staat al op pauze.',
  serie_al_bezig: 'Jullie zijn al met een themaweek bezig.',
  serie_niet_beschikbaar: 'Deze themaweek is niet (meer) beschikbaar.',
  duwtje_al_verstuurd: 'Je hebt vandaag al een seintje gestuurd. Morgen kan het weer.',
  duwtje_niet_beschikbaar: 'Dit kan nu niet.',
  geen_vragen: 'Er zijn nog geen vragen geladen. Controleer de database-migraties.',
};

export function friendlyError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (key) return MESSAGES[key];
  if (/network|fetch/i.test(raw)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  if (/anonymous sign-ins are disabled/i.test(raw)) return 'Inloggen zonder e-mail staat nog uit in Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).';
  if (/rate limit|too many/i.test(raw)) return 'Even rustig aan: probeer het over een paar minuten opnieuw.';
  if (/token.*(expired|invalid)|otp/i.test(raw)) return 'Die code klopt niet of is verlopen. Vraag een nieuwe aan.';
  return 'Er ging iets mis. Probeer het opnieuw.';
}
