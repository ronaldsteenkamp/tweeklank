import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AppText, Button, ErrorText, Field, Screen } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Inloggen() {
  const { colors } = useTheme();
  const { refresh } = useSession();
  const [busy, setBusy] = useState<'start' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');

  const validEmail = EMAIL_RE.test(email.trim());

  // Zonder e-mail: een account dat alleen op deze telefoon bestaat. Koppelen gaat met de uitnodigingscode.
  const start = async () => {
    setBusy('start');
    setError(null);
    const { error: err } = await supabase.auth.signInAnonymously();
    if (err) {
      setBusy(null);
      return setError(friendlyError(err));
    }
    await refresh();
    setBusy(null);
    router.replace('/');
  };

  const sendLink = async () => {
    setBusy('email');
    setError(null);
    const address = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth-callback') },
    });
    setBusy(null);
    if (err) return setError(friendlyError(err));
    router.push({ pathname: '/code', params: { email: address } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="display" color={colors.primary}>
              Tweeklank
            </AppText>
            <AppText variant="large" muted>
              Elke dag een vraag, samen een gesprek.
            </AppText>
          </View>
          <AppText>
            Geen e-mail, geen wachtwoord. Kies straks een naam en koppel je partner met een code.
          </AppText>
          <Button label="Beginnen" onPress={start} busy={busy === 'start'} disabled={busy !== null} />
          <AppText variant="small" muted>
            Je account staat op deze telefoon. Verwijder je de app of raak je je telefoon kwijt, dan begin je opnieuw.
          </AppText>
          <ErrorText message={error} />

          {showEmail ? (
            <View style={{ gap: spacing.md }}>
              <Field
                label="E-mailadres"
                value={email}
                onChangeText={setEmail}
                placeholder="naam@voorbeeld.nl"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => validEmail && sendLink()}
              />
              <Button kind="secondary" label="Stuur mij een inloglink" onPress={sendLink} disabled={!validEmail || busy !== null} busy={busy === 'email'} />
            </View>
          ) : (
            <Button kind="ghost" label="Liever inloggen met e-mail" onPress={() => setShowEmail(true)} />
          )}

          <AppText variant="small" muted>
            Helemaal gratis. Geen advertenties, geen abonnement en geen tracking.
          </AppText>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
