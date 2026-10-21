import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Loading, Screen } from '@/components/ui';
import { authCallbackMessage, parseAuthCallback } from '@/lib/authLink';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

// Hier komt de inloglink uit de e-mail binnen (deep link). We nemen de sessie over en gaan verder.
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { refresh } = useSession();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const handled = useRef<string | null>(null);
  const result = useMemo(() => parseAuthCallback(url), [url]);
  const error = sessionError ?? (result.kind === 'error' ? authCallbackMessage(result.code) : null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    if (result.kind === 'session') {
      supabase.auth
        .setSession({ access_token: result.accessToken, refresh_token: result.refreshToken })
        .then(async ({ error: err }) => {
          if (err) throw err;
          await refresh();
          router.replace('/');
        })
        .catch((e) => setSessionError(friendlyError(e)));
    } else if (result.kind === 'none') {
      router.replace('/');
    }
  }, [url, result, refresh]);

  if (!error) return <Loading label="Bezig met inloggen…" />;
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <AppText variant="title">Dat ging niet goed</AppText>
        <AppText>{error}</AppText>
        <Button label="Opnieuw inloggen" onPress={() => router.replace('/inloggen')} />
      </View>
    </Screen>
  );
}
