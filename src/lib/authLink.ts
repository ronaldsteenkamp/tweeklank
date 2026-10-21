// Inloggen via de link uit de e-mail. Supabase stuurt na het klikken door naar onze app
// (tweeklank://auth-callback, of exp://…/--/auth-callback in Expo Go) met de sessie in de URL:
//   …#access_token=…&refresh_token=…&type=magiclink     (gelukt)
//   …#error=access_denied&error_code=otp_expired&…      (verlopen of al gebruikt)

export type AuthCallback =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'none' };

export function parseAuthCallback(url: string | null | undefined): AuthCallback {
  if (!url) return { kind: 'none' };
  const params = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    new URLSearchParams(url.slice(queryIndex + 1, end)).forEach((v, k) => params.set(k, v));
  }
  if (hashIndex !== -1) new URLSearchParams(url.slice(hashIndex + 1)).forEach((v, k) => params.set(k, v));

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken };

  const error = params.get('error_code') ?? params.get('error');
  if (error) return { kind: 'error', code: error, description: params.get('error_description') ?? '' };
  return { kind: 'none' };
}

export function authCallbackMessage(code: string): string {
  if (code === 'otp_expired') return 'Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.';
  return 'Inloggen via de link lukte niet. Vraag een nieuwe link aan.';
}
