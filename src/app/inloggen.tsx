import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { AppText, Button, Field, Screen } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Inloggen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim());

  const send = async () => {
    setBusy(true);
    setError(null);
    const address = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth-callback') },
    });
    setBusy(false);
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
            Vul je e-mailadres in. Je krijgt een mail met een inloglink, zonder wachtwoord. Heb je nog geen account? Dan maken we
            er meteen een aan.
          </AppText>
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
            onSubmitEditing={() => valid && send()}
            error={error}
          />
          <Button label="Stuur mij een inloglink" onPress={send} disabled={!valid} busy={busy} />
          <AppText variant="small" muted>
            Helemaal gratis. Geen advertenties, geen abonnement en geen tracking.
          </AppText>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
