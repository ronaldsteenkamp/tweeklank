// Overzetcodes: 8 tekens, zonder verwarrende tekens (0/O, 1/I). Zie ook 20261027000100_overzetten.sql.
// Herstelcodes: 16 tekens uit hetzelfde alfabet, lang geldig (20261028001300_herstel.sql).
import { isTransferEmail } from '../../supabase/functions/_shared/transfer';

const CODE_RE = /^([A-HJ-NP-Z2-9]{8}|[A-HJ-NP-Z2-9]{16})$/;

export function normalizeTransferCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidTransferCode(input: string): boolean {
  return CODE_RE.test(normalizeTransferCode(input));
}

/** Voor weergave: 'ABCD EFGH', of 'ABCD EFGH JKLM NPQR' voor een herstelcode. */
export function formatTransferCode(code: string): string {
  const c = normalizeTransferCode(code);
  return c.length === 8 || c.length === 16 ? (c.match(/.{4}/g) ?? []).join(' ') : c;
}

/**
 * Staat dit account alleen op de telefoon (geen echt e-mailadres)? Ook na overzetten,
 * want dan heeft het account een intern adres dat niemand kan ontvangen.
 */
export function isPhoneOnlyAccount(user: { is_anonymous?: boolean; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  return !!user.is_anonymous || !user.email || isTransferEmail(user.email);
}
