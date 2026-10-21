import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AppText, Button, Field, Screen } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

export default function Code() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { refresh } = useSession();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const digits = token.replace(/\D/g, '');
  // Supabase gebruikt standaard 6 cijfers; sommige projecten staan op 8.
  const valid = digits.length >= 6 && digits.length <= 8;

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: String(email), token: digits, type: 'email' });
    if (err) {
      setBusy(false);
      return setError(friendlyError(err));
    }
    await refresh();
    setBusy(false);
    router.replace('/');
  };

  const resend = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: String(email),
      options: { emailRedirectTo: Linking.createURL('auth-callback') },
    });
    if (err) setError(friendlyError(err));
    else setInfo('We hebben een nieuwe mail gestuurd.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <AppText variant="title">Check je mail</AppText>
          <AppText>
            We hebben een mail gestuurd naar <AppText variant="label">{email}</AppText>. Open die{' '}
            <AppText variant="label">op deze telefoon</AppText> en tik op de inloglink. De app opent dan vanzelf en je bent
            ingelogd.
          </AppText>
          <AppText variant="small" muted>
            Staat er in plaats van een link een code van 6 cijfers in de mail? Vul die dan hieronder in.
          </AppText>
          <Field
            label="Code uit de e-mail (alleen als die erin staat)"
            value={token}
            onChangeText={setToken}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
            placeholder="123456"
            style={{ fontSize: 26, letterSpacing: 6, textAlign: 'center' }}
            onSubmitEditing={() => valid && verify()}
            error={error}
          />
          <Button kind="secondary" label="Inloggen met code" onPress={verify} disabled={!valid} busy={busy} />
          <Button kind="ghost" label="Stuur een nieuwe mail" onPress={resend} />
          {info ? <AppText variant="small" muted accessibilityLiveRegion="polite">{info}</AppText> : null}
          <Button kind="ghost" label="Ander e-mailadres" onPress={() => router.back()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
