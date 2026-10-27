import { isTransferEmail, transferEmail } from '../supabase/functions/_shared/transfer';
import { formatTransferCode, isPhoneOnlyAccount, isValidTransferCode, normalizeTransferCode } from '../src/lib/transfer';

describe('overzetcodes', () => {
  it('normaliseert invoer', () => {
    expect(normalizeTransferCode(' abcd-ef23 ')).toBe('ABCDEF23');
    expect(isValidTransferCode('abcd ef23')).toBe(true);
  });

  it('weigert ongeldige codes', () => {
    expect(isValidTransferCode('ABCDEF2')).toBe(false);
    expect(isValidTransferCode('ABCDEF201')).toBe(false);
    expect(isValidTransferCode('ABCDEFG0')).toBe(false);
    expect(isValidTransferCode('ABCDEFGI')).toBe(false);
  });

  it('toont de code in twee blokjes', () => {
    expect(formatTransferCode('abcdef23')).toBe('ABCD EF23');
  });

  it('accepteert ook een herstelcode van 16 tekens', () => {
    expect(isValidTransferCode('abcd-ef23 ghjk mnpq')).toBe(true);
    expect(isValidTransferCode('ABCDEF23GHJKMNP')).toBe(false);
    expect(formatTransferCode('abcdef23ghjkmnpq')).toBe('ABCD EF23 GHJK MNPQ');
  });
});

describe('account alleen op de telefoon', () => {
  const id = '11111111-1111-1111-1111-111111111111';

  it('herkent het interne adres na overzetten', () => {
    expect(isTransferEmail(transferEmail(id))).toBe(true);
    expect(isTransferEmail('ronald@voorbeeld.nl')).toBe(false);
    expect(isTransferEmail(null)).toBe(false);
  });

  it('anoniem, zonder e-mail of na overzetten telt als alleen op de telefoon', () => {
    expect(isPhoneOnlyAccount({ is_anonymous: true })).toBe(true);
    expect(isPhoneOnlyAccount({ is_anonymous: false, email: null })).toBe(true);
    expect(isPhoneOnlyAccount({ is_anonymous: false, email: transferEmail(id) })).toBe(true);
    expect(isPhoneOnlyAccount({ is_anonymous: false, email: 'ronald@voorbeeld.nl' })).toBe(false);
  });
});
