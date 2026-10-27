import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppText, Button, Card, ErrorText, Screen } from '@/components/ui';
import { createRecoveryCode, hasRecoveryCode } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { formatTransferCode } from '@/lib/transfer';
import { useTheme } from '@/theme/ThemeProvider';

// Een herstelcode om te bewaren: zo kom je terug in je account als je telefoon kwijt is.
export default function Herstelcode() {
  const { colors } = useTheme();
  const [code, setCode] = useState<string | null>(null);
  const [hasCode, setHasCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasRecoveryCode()
        .then(setHasCode)
        .catch(() => setHasCode(false));
    }, []),
  );

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      setCode(await createRecoveryCode());
      setCopied(false);
      setHasCode(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Herstelcode</AppText>
      <AppText>
        Je account staat alleen op deze telefoon. Met een herstelcode kom je terug in je account als je telefoon kwijt of
        kapot is, met je koppeling en al jullie antwoorden.
      </AppText>
      {code ? (
        <Card tone="alt">
          <AppText variant="label" muted>
            Jouw herstelcode
          </AppText>
          <AppText variant="display" color={colors.primary} selectable accessibilityLabel={`Herstelcode: ${code.split('').join(' ')}`}>
            {formatTransferCode(code)}
          </AppText>
          <Button
            kind="secondary"
            label={copied ? 'Gekopieerd' : 'Kopieer de code'}
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          />
        </Card>
      ) : (
        <Button label={hasCode ? 'Maak een nieuwe herstelcode' : 'Maak een herstelcode'} onPress={make} busy={busy} />
      )}
      <Card>
        <AppText variant="large">Bewaar hem veilig</AppText>
        <AppText>
          Zet de code in een wachtwoordmanager of schrijf hem op papier en bewaar dat thuis. Wie de code heeft, komt in je
          account. Deel hem daarom met niemand.
        </AppText>
        <AppText>
          Je gebruikt hem op een nieuwe telefoon via Beginnen → Ik heb een overzetcode. Een code werkt één keer. Maak daarna
          een nieuwe.
        </AppText>
        {hasCode && !code ? (
          <AppText variant="small" muted>
            Je hebt al een herstelcode. Een nieuwe maken laat de oude vervallen.
          </AppText>
        ) : null}
      </Card>
      <ErrorText message={error} />
    </Screen>
  );
}
