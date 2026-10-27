import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { redeemTransferCode } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { isValidTransferCode, normalizeTransferCode } from '@/lib/transfer';

// Op de nieuwe telefoon: vul de overzetcode van je oude telefoon in.
export default function Overzetcode() {
  const { refresh } = useSession();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidTransferCode(input);

  const redeem = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await redeemTransferCode(normalizeTransferCode(input));
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppText variant="title">Account overzetten</AppText>
        <AppText muted>
          Open Tweeklank op je oude telefoon en ga naar Ik → Naar een nieuwe telefoon. Daar maak je een code die 15
          minuten geldig is. Heb je een herstelcode van 16 tekens bewaard? Die kun je hier ook invullen.
        </AppText>
        <Card>
          <Field
            label="Overzetcode of herstelcode"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder="ABCD 2345"
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={redeem}
          />
          <Button label="Zet mijn account over" onPress={redeem} disabled={!valid} busy={busy} />
        </Card>
        <ErrorText message={error} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
