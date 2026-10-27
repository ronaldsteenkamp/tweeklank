// Gedeeld tussen de app en de Edge Function transfer-account (geen Deno- of Node-API's).

/**
 * Een account zonder e-mail krijgt bij het overzetten een intern adres, omdat Supabase alleen
 * via een e-mailadres een inloglink kan maken. Het domein `.invalid` bestaat nooit, dus er wordt
 * nooit echt iets naartoe gestuurd. De app toont dit adres niet.
 */
export const TRANSFER_EMAIL_DOMAIN = 'overzetten.tweeklank.invalid';

export function transferEmail(userId: string): string {
  return `${userId}@${TRANSFER_EMAIL_DOMAIN}`;
}

export function isTransferEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${TRANSFER_EMAIL_DOMAIN}`);
}
