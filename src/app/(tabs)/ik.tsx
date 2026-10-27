import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { HelpLink } from '@/components/HelpLink';
import { AppText, Button, Card, Chip, ErrorText, Field, Row, Screen } from '@/components/ui';
import { deleteAccount, fetchWeek, leaveCouple, setWeekGoal, startPause, stopPause, updateProfile } from '@/lib/api';
import { confirmSignOut, signOut } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { registerForPush, unregisterPush } from '@/lib/push';
import { hourLabel, shiftHour } from '@/lib/nudge';
import { PAUSE_OPTIONS, pauseLabel, WEEK_GOALS, type WeekStatus } from '@/lib/rhythm';
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
  const [week, setWeek] = useState<WeekStatus | null>(null);

  const loadWeek = useCallback(() => {
    fetchWeek()
      .then(setWeek)
      .catch(() => setWeek(null));
  }, []);
  useFocusEffect(loadWeek);

  const partnerName = partner?.display_name || 'je partner';
  const phoneOnly = isPhoneOnlyAccount(session?.user);

  const toggleNotify = (key: 'notify_new_question' | 'notify_partner_answered' | 'notify_dates' | 'notify_nudges', value: boolean) =>
    run(key, async () => {
      if (!session || !me) return;
      setPushInfo(null);
      await updateProfile(session.user.id, { [key]: value });
      const next = { ...me, [key]: value };
      const anyOn = next.notify_new_question || next.notify_partner_answered || next.notify_dates || next.notify_nudges;
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

  const changeHour = (delta: number) =>
    run('hour', async () => {
      if (!session || !me) return;
      await updateProfile(session.user.id, { notify_hour: shiftHour(me.notify_hour ?? 9, delta) });
      await refresh();
    });

  const chooseGoal = (goal: number) =>
    run('goal', async () => {
      await setWeekGoal(goal);
      loadWeek();
    });

  const pause = (weeks: 1 | 2 | 4 | null) =>
    run('pause', async () => {
      await startPause(weeks);
      loadWeek();
    });

  const unpause = () =>
    run('pause', async () => {
      await stopPause();
      loadWeek();
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
          hint={`Elke dag om ${hourLabel(me?.notify_hour ?? 9)}`}
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
        <AppText accessibilityLiveRegion="polite">Meldtijd: {hourLabel(me?.notify_hour ?? 9)} (Nederlandse tijd)</AppText>
        <Row gap={spacing.sm} wrap>
          <Button kind="secondary" label="Eerder" onPress={() => changeHour(-1)} disabled={busy !== null} accessibilityHint="Meldtijd een uur eerder" />
          <Button kind="secondary" label="Later" onPress={() => changeHour(1)} disabled={busy !== null} accessibilityHint="Meldtijd een uur later" />
        </Row>
        <NotifySwitch
          label={`"Ik denk aan je" van ${partnerName}`}
          hint="Een seintje zonder inhoud, hoogstens één per dag"
          value={!!me?.notify_nudges}
          disabled={busy !== null}
          onChange={(v) => toggleNotify('notify_nudges', v)}
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

      {week && (
        <Card>
          <AppText variant="large">Ons weekritme</AppText>
          <AppText variant="small" muted>
            Een samen-dag is een dag waarop jullie allebei de dagvraag beantwoorden. Kies samen hoeveel samen-dagen per
            week bij jullie past. Een wijziging zien jullie allebei en geldt vanaf deze week.
          </AppText>
          <Row wrap>
            {WEEK_GOALS.map((g) => (
              <Chip
                key={g}
                label={String(g)}
                active={week.chosen_goal === g}
                onPress={() => chooseGoal(g)}
                accessibilityLabel={`Weekdoel: ${g} samen-dagen`}
              />
            ))}
          </Row>
          <AppText variant="large" style={{ marginTop: spacing.sm }}>
            Pauze
          </AppText>
          <AppText variant="small" muted>
            Druk, op reis of even geen zin? Een gepauzeerde week telt niet mee en onderbreekt jullie ritme niet.
          </AppText>
          {pauseLabel(week) ? (
            <AppText variant="small" color={colors.secondary} accessibilityLiveRegion="polite">
              {pauseLabel(week)}
            </AppText>
          ) : null}
          {week.pause_active ? (
            <Button kind="secondary" label="Pauze uitzetten" onPress={unpause} busy={busy === 'pause'} />
          ) : (
            <Row wrap>
              {PAUSE_OPTIONS.map((o) => (
                <Button
                  key={o.label}
                  kind="secondary"
                  label={o.label}
                  onPress={() => pause(o.weeks)}
                  disabled={busy !== null}
                  accessibilityHint={o.weeks ? `Pauzeer jullie ritme ${o.label}` : 'Pauzeer tot een van jullie hem uitzet'}
                />
              ))}
            </Row>
          )}
        </Card>
      )}

      <Card>
        <AppText variant="large">Een jaar geleden</AppText>
        <NotifySwitch
          label="Toon mijn antwoord van de vorige keer"
          hint="Bij een vraag die terugkomt, na je nieuwe antwoord"
          value={!!me?.show_year_ago}
          disabled={busy !== null}
          onChange={(v) =>
            run('yearago', async () => {
              if (!session) return;
              await updateProfile(session.user.id, { show_year_ago: v });
              await refresh();
            })
          }
        />
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
      <HelpLink />
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
