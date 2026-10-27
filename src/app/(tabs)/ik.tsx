import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Row, Screen } from '@/components/ui';
import { deleteAccount, leaveCouple, updateProfile } from '@/lib/api';
import { confirmSignOut, signOut } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { registerForPush, unregisterPush } from '@/lib/push';
import { isPhoneOnlyAccount } from '@/lib/transfer';
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

  const [pushInfo, setPushInfo] = useState<string | null>(null);

  const partnerName = partner?.display_name || 'je partner';
  const phoneOnly = isPhoneOnlyAccount(session?.user);

  const toggleNotify = (key: 'notify_new_question' | 'notify_partner_answered' | 'notify_dates', value: boolean) =>
    run(key, async () => {
      if (!session || !me) return;
      setPushInfo(null);
      await updateProfile(session.user.id, { [key]: value });
      const next = { ...me, [key]: value };
      const anyOn = next.notify_new_question || next.notify_partner_answered || next.notify_dates;
      if (anyOn) {
        const result = await registerForPush();
        if (!result.ok) setPushInfo(result.message);
      } else {
        await unregisterPush();
      }
      await refresh();
    });

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

  const setExplicit = (on: boolean) => {
    if (!session || !me) return;
    if (!on) {
      run('explicit', async () => {
        await updateProfile(session.user.id, { explicit_opt_in: false });
        await refresh();
      });
      return;
    }
    Alert.alert(
      '18+ gesprekskaarten aanzetten?',
      `Bevestig dat je 18 jaar of ouder bent. De set wordt pas zichtbaar als ${partnerName} hem ook aanzet. Jullie kunnen hem allebei altijd weer uitzetten.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Ik ben 18+, zet aan',
          onPress: () =>
            run('explicit', async () => {
              await updateProfile(session.user.id, {
                explicit_opt_in: true,
                adult_confirmed_at: me.adult_confirmed_at ?? new Date().toISOString(),
              });
              await refresh();
            }),
        },
      ],
    );
  };

  const explicitStatus = (() => {
    const mine = !!me?.explicit_opt_in;
    const theirs = !!partner?.explicit_opt_in;
    if (mine && theirs) return 'Staat aan voor jullie allebei. Je vindt de set onder Kaarten.';
    if (mine) return `Wacht op ${partnerName}. Pas als jullie het allebei aanzetten, verschijnt de set.`;
    if (theirs) return `${partnerName} heeft dit aangezet. Zet het ook aan als je dat wilt.`;
    return null;
  })();

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
              await unregisterPush();
              await deleteAccount();
              await signOut();
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
          {phoneOnly ? 'Account zonder e-mail, alleen op deze telefoon.' : session?.user.email}
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
        <AppText variant="large">Meldingen</AppText>
        <NotifySwitch
          label="De vraag van vandaag staat klaar"
          hint="Elke ochtend om 9 uur"
          value={!!me?.notify_new_question}
          disabled={busy !== null}
          onChange={(v) => toggleNotify('notify_new_question', v)}
        />
        <NotifySwitch
          label={`${partnerName.charAt(0).toUpperCase()}${partnerName.slice(1)} heeft geantwoord`}
          hint="Zonder de inhoud van het antwoord"
          value={!!me?.notify_partner_answered}
          disabled={busy !== null}
          onChange={(v) => toggleNotify('notify_partner_answered', v)}
        />
        <NotifySwitch
          label="Herinneringen aan belangrijke datums"
          hint="Zoals ingesteld per datum onder Samen"
          value={!!me?.notify_dates}
          disabled={busy !== null}
          onChange={(v) => toggleNotify('notify_dates', v)}
        />
        {pushInfo ? (
          <AppText variant="small" muted accessibilityLiveRegion="polite">
            {pushInfo}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="large">18+ gesprekskaarten</AppText>
        <AppText variant="small" muted>
          Een extra set openhartige vragen over seks, fantasieën en grenzen. Alleen zichtbaar als jullie hem allebei
          aanzetten.
        </AppText>
        <NotifySwitch
          label="Toon de 18+-set"
          hint="Je bevestigt dat je 18 jaar of ouder bent"
          value={!!me?.explicit_opt_in}
          disabled={busy !== null}
          onChange={setExplicit}
        />
        {explicitStatus ? (
          <AppText variant="small" color={colors.secondary} accessibilityLiveRegion="polite">
            {explicitStatus}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText variant="large">Koppeling</AppText>
        <AppText muted>Je bent gekoppeld aan {partnerName}.</AppText>
        <Button kind="danger" label="Ontkoppelen" onPress={confirmUnlink} busy={busy === 'unlink'} />
      </Card>

      <Card>
        <AppText variant="large">Nieuwe telefoon?</AppText>
        <AppText muted>
          {phoneOnly
            ? 'Je account staat alleen op deze telefoon. Neem het mee met een overzetcode, met je koppeling en al jullie antwoorden.'
            : 'Op een nieuwe telefoon log je in met je e-mailadres, of je gebruikt een overzetcode.'}
        </AppText>
        <Button kind="secondary" label="Naar een nieuwe telefoon" onPress={() => router.push('/overzetten')} />
      </Card>

      <Card>
        <AppText variant="large">Privacy</AppText>
        <AppText muted>Jullie antwoorden zijn alleen voor jullie twee. Geen advertenties, geen tracking.</AppText>
        <Button kind="ghost" label="Lees hoe we met je gegevens omgaan" onPress={() => router.push('/privacy')} />
      </Card>

      <ErrorText message={error} />

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button kind="secondary" label="Uitloggen" onPress={() => confirmSignOut(phoneOnly, () => router.replace('/'))} />
        <Button kind="danger" label="Account verwijderen" onPress={confirmDelete} busy={busy === 'delete'} />
      </View>
    </Screen>
  );
}

function NotifySwitch({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Row gap={spacing.md}>
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        <AppText variant="small" muted>
          {hint}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </Row>
  );
}
