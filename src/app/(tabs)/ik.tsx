import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Row, Screen } from '@/components/ui';
import { deleteAccount, leaveCouple, updateProfile } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Systeem' },
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
];

export default function Ik() {
  const { colors, pref, setPref } = useTheme();
  const { session, me, partner, refresh } = useSession();
  const [name, setName] = useState(me?.display_name ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const partnerName = partner?.display_name || 'je partner';

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const saveName = () =>
    run('name', async () => {
      if (!session) return;
      await updateProfile(session.user.id, { display_name: name.trim() });
      await refresh();
      setSaved(true);
    });

  const confirmUnlink = () =>
    Alert.alert(
      'Ontkoppelen?',
      `Je koppeling met ${partnerName} wordt verbroken. Alle gedeelde antwoorden, reacties en andere gedeelde data worden voor jullie allebei definitief verwijderd.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Ontkoppelen en verwijderen',
          style: 'destructive',
          onPress: () =>
            run('unlink', async () => {
              await leaveCouple();
              await refresh();
              router.replace('/');
            }),
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      'Account verwijderen?',
      'Je account, je profiel en alle gedeelde data met je partner worden definitief verwijderd. Dit kun je niet ongedaan maken.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Definitief verwijderen',
          style: 'destructive',
          onPress: () =>
            run('delete', async () => {
              await deleteAccount();
              await supabase.auth.signOut();
              router.replace('/');
            }),
        },
      ],
    );

  return (
    <Screen>
      <AppText variant="title">Ik</AppText>

      <Card>
        <AppText variant="large">Profiel</AppText>
        <AppText variant="small" muted>
          {session?.user.email}
        </AppText>
        <Field
          label="Naam die je partner ziet"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setSaved(false);
          }}
          maxLength={40}
        />
        <Button
          kind="secondary"
          label={saved ? 'Opgeslagen' : 'Naam opslaan'}
          onPress={saveName}
          disabled={!name.trim() || name.trim() === me?.display_name}
          busy={busy === 'name'}
        />
      </Card>

      <Card>
        <AppText variant="large">Weergave</AppText>
        <Row>
          {THEME_OPTIONS.map((o) => {
            const active = pref === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => setPref(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Thema ${o.label}`}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="label" color={active ? colors.onPrimary : colors.text}>
                  {o.label}
                </AppText>
              </Pressable>
            );
          })}
        </Row>
        <AppText variant="small" muted>
          Tekstgrootte volgt de instelling van je telefoon.
        </AppText>
      </Card>

      <Card>
        <AppText variant="large">Koppeling</AppText>
        <AppText muted>Je bent gekoppeld aan {partnerName}.</AppText>
        <Button kind="danger" label="Ontkoppelen" onPress={confirmUnlink} busy={busy === 'unlink'} />
      </Card>

      <Card>
        <AppText variant="large">Privacy</AppText>
        <AppText muted>Jullie antwoorden zijn alleen voor jullie twee. Geen advertenties, geen tracking.</AppText>
        <Button kind="ghost" label="Lees hoe we met je gegevens omgaan" onPress={() => router.push('/privacy')} />
      </Card>

      <ErrorText message={error} />

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button kind="secondary" label="Uitloggen" onPress={() => supabase.auth.signOut().then(() => router.replace('/'))} />
        <Button kind="danger" label="Account verwijderen" onPress={confirmDelete} busy={busy === 'delete'} />
      </View>
    </Screen>
  );
}
