import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, ErrorText, Screen } from '@/components/ui';
import { createTransferCode } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatTransferCode } from '@/lib/transfer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// Op de oude telefoon: laat een overzetcode zien die je op de nieuwe telefoon invult.
export default function Overzetten() {
  const { colors } = useTheme();
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setCode(await createTransferCode());
      setNow(Date.now());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // Elke 10 seconden de resterende tijd bijwerken zolang het scherm open is.
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => setNow(Date.now()), 10_000);
      return () => clearInterval(t);
    }, []),
  );

  const minutesLeft = code ? Math.max(0, Math.ceil((new Date(code.expires_at).getTime() - now) / 60_000)) : 0;
  const expired = !!code && minutesLeft === 0;

  return (
    <Screen>
      <AppText variant="title">Naar een nieuwe telefoon</AppText>
      <AppText muted>
        Je account staat op deze telefoon. Met een overzetcode neem je het mee naar een nieuwe telefoon, met je
        koppeling en al jullie antwoorden.
      </AppText>

      <Card>
        <AppText variant="large">Zo werkt het</AppText>
        <AppText>1. Installeer Tweeklank op je nieuwe telefoon.</AppText>
        <AppText>2. Tik daar op Ik heb een overzetcode.</AppText>
        <AppText>3. Vul de code hieronder in.</AppText>
      </Card>

      <Card>
        {code && !expired ? (
          <View style={{ gap: spacing.sm }}>
            <AppText
              variant="display"
              color={colors.primary}
              selectable
              accessibilityLabel={`Overzetcode: ${code.code.split('').join(' ')}`}
              style={{ letterSpacing: 4, textAlign: 'center', marginVertical: spacing.sm }}
            >
              {formatTransferCode(code.code)}
            </AppText>
            <AppText variant="small" muted style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
              Nog {minutesLeft} {minutesLeft === 1 ? 'minuut' : 'minuten'} geldig en maar één keer te gebruiken.
            </AppText>
            <Button kind="ghost" label="Maak een nieuwe code" onPress={make} busy={busy} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {expired ? <AppText muted>Deze code is verlopen.</AppText> : null}
            <Button label="Maak een overzetcode" onPress={make} busy={busy} />
          </View>
        )}
      </Card>

      <AppText variant="small" muted>
        Deel deze code met niemand: wie hem heeft, komt in je account. Na het overzetten kun je op deze telefoon
        uitloggen of de app verwijderen.
      </AppText>

      <ErrorText message={error} />
    </Screen>
  );
}
