import {
  extractInviteCode,
  formatInviteCode,
  INVITE_ALPHABET,
  isValidInviteCode,
  normalizeInviteCode,
} from '../src/lib/invite';

describe('uitnodigingscodes', () => {
  it('bevat geen verwarrende tekens', () => {
    for (const ch of ['0', 'O', '1', 'I']) expect(INVITE_ALPHABET).not.toContain(ch);
  });

  it('normaliseert invoer', () => {
    expect(normalizeInviteCode(' abc-d2e ')).toBe('ABCD2E');
    expect(isValidInviteCode('abc d2e')).toBe(true);
  });

  it('weigert ongeldige codes', () => {
    expect(isValidInviteCode('ABCDE')).toBe(false);
    expect(isValidInviteCode('ABCDE0')).toBe(false);
    expect(isValidInviteCode('ABCDEI')).toBe(false);
    expect(isValidInviteCode('ABCDEFG')).toBe(false);
  });

  it('toont codes in twee groepjes', () => {
    expect(formatInviteCode('abcd2e')).toBe('ABC D2E');
  });

  it('haalt de code uit een gedeelde link of tekst', () => {
    expect(extractInviteCode('tweeklank://koppel/ABC234')).toBe('ABC234');
    expect(extractInviteCode('exp://192.168.1.2:8081/--/koppel/abc234')).toBe('ABC234');
    expect(extractInviteCode('abc 234')).toBe('ABC234');
    expect(extractInviteCode('hallo daar')).toBeNull();
  });
});
