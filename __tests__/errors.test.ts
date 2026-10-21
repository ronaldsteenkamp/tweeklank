import { friendlyError } from '../src/lib/errors';

describe('friendlyError', () => {
  it('vertaalt foutcodes uit de database', () => {
    expect(friendlyError({ message: 'code_verlopen' })).toMatch(/verlopen/);
    expect(friendlyError(new Error('eigen_code'))).toMatch(/eigen code/);
  });

  it('valt terug op een algemene melding', () => {
    expect(friendlyError({ message: 'iets onbekends' })).toBe('Er ging iets mis. Probeer het opnieuw.');
    expect(friendlyError(undefined)).toBe('Er ging iets mis. Probeer het opnieuw.');
  });

  it('legt uit dat anoniem inloggen nog uit staat', () => {
    expect(friendlyError({ message: 'Anonymous sign-ins are disabled' })).toMatch(/Allow anonymous sign-ins/);
  });
});
