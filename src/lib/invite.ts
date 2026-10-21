// Uitnodigingscodes: 6 tekens, zonder verwarrende tekens (0/O, 1/I). Zie ook de check in de database.
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Maakt invoer netjes: hoofdletters, zonder spaties of streepjes. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(input: string): boolean {
  return CODE_RE.test(normalizeInviteCode(input));
}

/** Voor weergave: 'ABC DEF'. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

/** Haalt een code uit een gedeelde link of tekst, bijv. 'tweeklank://koppel/ABC234'. */
export function extractInviteCode(text: string): string | null {
  const fromLink = text.match(/koppel\/([A-Za-z0-9]{6})(?![A-Za-z0-9])/);
  if (fromLink && isValidInviteCode(fromLink[1])) return normalizeInviteCode(fromLink[1]);
  const plain = normalizeInviteCode(text);
  return CODE_RE.test(plain) ? plain : null;
}

export function inviteShareMessage(code: string, link: string): string {
  return (
    `Doe je mee in Tweeklank? Dan beantwoorden we elke dag samen een vraag.\n\n` +
    `Mijn code: ${formatInviteCode(code)}\n` +
    `Of open deze link op je telefoon: ${link}\n\n` +
    `De code is 7 dagen geldig.`
  );
}
