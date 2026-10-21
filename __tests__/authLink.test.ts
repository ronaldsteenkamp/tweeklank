import { authCallbackMessage, parseAuthCallback } from '../src/lib/authLink';

describe('inloglink', () => {
  it('haalt de sessie uit de fragment-URL', () => {
    expect(
      parseAuthCallback('tweeklank://auth-callback#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=magiclink'),
    ).toEqual({ kind: 'session', accessToken: 'abc', refreshToken: 'def' });
  });

  it('werkt ook met de Expo Go-URL', () => {
    expect(parseAuthCallback('exp://192.168.1.5:8081/--/auth-callback#access_token=a&refresh_token=b').kind).toBe('session');
  });

  it('herkent een verlopen link', () => {
    const r = parseAuthCallback(
      'tweeklank://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(r).toEqual({ kind: 'error', code: 'otp_expired', description: 'Email link is invalid or has expired' });
    expect(authCallbackMessage('otp_expired')).toMatch(/verlopen/);
  });

  it('leest fouten ook uit de query', () => {
    expect(parseAuthCallback('tweeklank://auth-callback?error=server_error').kind).toBe('error');
  });

  it('negeert gewone links', () => {
    expect(parseAuthCallback('tweeklank://koppel/ABC234')).toEqual({ kind: 'none' });
    expect(parseAuthCallback(null)).toEqual({ kind: 'none' });
  });
});
