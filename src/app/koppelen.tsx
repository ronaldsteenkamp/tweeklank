import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { createInvite, fetchOpenInvite, redeemInvite } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { extractInviteCode, formatInviteCode, inviteShareMessage, isValidInviteCode } from '@/lib/invite';
import { takePendingInvite } from '@/lib/pendingInvite';
import { useSession } from '@/lib/session';
import { confirmSignOut } from '@/lib/auth';
import { isPhoneOnlyAccount } from '@/lib/transfer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Koppelen() {
  const { colors } = useTheme();
  const { session, me, partner, refresh } = useSession();
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'create' | 'redeem' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOpenInvite().then(setInvite).catch(() => {});
    takePendingInvite().then((code) => code && setInput(code));
  }, []);

  // Zodra de partner gekoppeld is: door naar de app.
  useEffect(() => {
    if (partner) router.replace('/vandaag');
  }, [partner]);

  // Terwijl je wacht op je partner: elke 5 seconden kijken of de koppeling rond is.
  useFocusEffect(
    useCallback(() => {
      if (!invite) return;
      const t = setInterval(() => refresh().catch(() => {}), 5000);
      return () => clearInterval(t);
    }, [invite, refresh]),
  );

  const makeInvite = async () => {
    setBusy('create');
    setError(null);
    try {
      setInvite(await createInvite());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!invite) return;
    const link = Linking.createURL(`koppel/${invite.code}`);
    await Share.share({ message: inviteShareMessage(invite.code, link) });
  };

  const copy = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.code);
    setCopied(true);
  };

  const redeem = async () => {
    const code = extractInviteCode(input);
    if (!code) return;
    setBusy('redeem');
    setError(null);
    try {
      await redeemInvite(code);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const expires = invite
    ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(
        new Date(invite.expires_at),
      )
    : null;

  return (
    <Screen>
      <AppText variant="title">Hoi {me?.display_name}! Koppel je partner</AppText>
      <AppText muted>
        Een van jullie maakt een code, de ander vult die in. Daarna zien jullie elke dag dezelfde vraag.
      </AppText>

      <Card>
        <AppText variant="large">Nodig je partner uit</AppText>
        {invite ? (
          <View style={{ gap: spacing.sm }}>
            <AppText
              variant="display"
              color={colors.primary}
              selectable
              accessibilityLabel={`Jouw code: ${invite.code.split('').join(' ')}`}
              style={{ letterSpacing: 4, textAlign: 'center', marginVertical: spacing.sm }}
            >
              {formatInviteCode(invite.code)}
            </AppText>
            <AppText variant="small" muted style={{ textAlign: 'center' }}>
              Geldig tot {expires}. We kijken automatisch of je partner de code heeft ingevuld.
            </AppText>
            <Button label="Deel uitnodiging" onPress={share} />
            <Button kind="secondary" label={copied ? 'Gekopieerd!' : 'Kopieer code'} onPress={copy} />
            <Button kind="ghost" label="Maak een nieuwe code" onPress={makeInvite} busy={busy === 'create'} />
          </View>
        ) : (
          <Button label="Maak een code" onPress={makeInvite} busy={busy === 'create'} />
        )}
      </Card>

      <Card>
        <AppText variant="large">Heb je een code gekregen?</AppText>
        <Field
          label="Code van je partner"
          value={input}
          onChangeText={setInput}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABC 234"
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={redeem}
        />
        <Button
          label="Koppelen"
          onPress={redeem}
          disabled={!isValidInviteCode(input) && !extractInviteCode(input)}
          busy={busy === 'redeem'}
        />
      </Card>

      <ErrorText message={error} />
      <Button kind="ghost" label="Uitloggen" onPress={() => confirmSignOut(isPhoneOnlyAccount(session?.user), () => router.replace('/'))} />
    </Screen>
  );
}
