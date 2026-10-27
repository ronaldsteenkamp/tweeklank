import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Een e-mailadres aan je account koppelen. Daarna kun je overal inloggen met een inloglink.
export default function EmailKoppelen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_RE.test(email.trim());

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo: Linking.createURL('auth-callback') },
    );
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setSent(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppText variant="title">E-mail koppelen</AppText>
        <AppText>
          Koppel een e-mailadres aan je account. Dan kun je op elke telefoon inloggen met een inloglink, ook als deze
          telefoon kwijt is. We gebruiken het adres nergens anders voor.
        </AppText>
        {sent ? (
          <Card tone="alt">
            <AppText accessibilityLiveRegion="polite">
              Check je mail en tik op de link om het adres te bevestigen. Daarna is het gekoppeld.
            </AppText>
          </Card>
        ) : (
          <Card>
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
            />
            <Button label="Stuur een bevestigingslink" onPress={send} disabled={!valid} busy={busy} />
          </Card>
        )}
        <ErrorText message={error} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
