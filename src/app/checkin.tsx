import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { HelpLink } from '@/components/HelpLink';
import { AppText, Button, Card, Chip, ErrorText, Field, Loading, Row, Screen } from '@/components/ui';
import { fetchCheckinOpenMonth, fetchCheckins, fetchExercises, saveCheckin } from '@/lib/api';
import {
  latestOwnMonth,
  lowScales,
  SCALES,
  shiftsFor,
  WISH_QUESTION,
  type Checkin,
  type ScaleKey,
} from '@/lib/checkin';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const monthName = (month: string) =>
  new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`));

export default function CheckinScherm() {
  const { colors } = useTheme();
  const { me, partner, coupleId } = useSession();
  const [openMonth, setOpenMonth] = useState<string | null | undefined>(undefined);
  const [rows, setRows] = useState<Checkin[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Partial<Record<ScaleKey, number>>>({});
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, r, ex] = await Promise.all([fetchCheckinOpenMonth(), fetchCheckins(), fetchExercises()]);
      setOpenMonth(m);
      setRows(r);
      setTitles(Object.fromEntries(ex.map((e) => [e.slug, e.title])));
    } catch (e) {
      setError(friendlyError(e));
      setOpenMonth(null);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!me || openMonth === undefined) return <Loading />;

  const partnerName = partner?.display_name || 'Je partner';
  const filledThisMonth = !!openMonth && rows.some((r) => r.user_id === me.id && r.month === openMonth);
  const complete = SCALES.every((s) => values[s.key]);

  const submit = async () => {
    if (!coupleId || !openMonth || !complete) return;
    setBusy(true);
    setError(null);
    try {
      await saveCheckin({ coupleId, userId: me.id, month: openMonth, values: values as Record<ScaleKey, number>, wish });
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (openMonth && !filledThisMonth) {
    return (
      <Screen>
        <AppText variant="title">Hoe gaat het met ons?</AppText>
        <AppText muted>
          De check-in van {monthName(openMonth)}. Jullie zien elkaars antwoorden pas als jullie allebei hebben ingevuld.
          Daarna zie je alleen wat er veranderde ten opzichte van vorige maand.
        </AppText>
        {SCALES.map((s) => (
          <Card key={s.key}>
            <AppText variant="large">{s.question}</AppText>
            <AppText variant="small" muted>
              1 = helemaal niet, 5 = heel erg
            </AppText>
            <Row wrap>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  label={String(n)}
                  active={values[s.key] === n}
                  onPress={() => setValues((v) => ({ ...v, [s.key]: n }))}
                  accessibilityLabel={`${s.label}: ${n} van 5`}
                />
              ))}
            </Row>
          </Card>
        ))}
        <Field label={WISH_QUESTION} value={wish} onChangeText={setWish} maxLength={500} multiline placeholder="Iets kleins of iets groots…" />
        <AppText variant="small" muted>
          Na het delen kun je je check-in niet meer aanpassen.
        </AppText>
        <Button label="Check-in delen" onPress={submit} disabled={!complete} busy={busy} />
        <ErrorText message={error} />
      </Screen>
    );
  }

  const month = latestOwnMonth(rows, me.id);
  if (!month) {
    return (
      <Screen>
        <AppText variant="title">Hoe gaat het met ons?</AppText>
        <AppText muted>
          Elke maand kunnen jullie in de eerste week samen even stilstaan bij hoe het gaat. De volgende check-in staat klaar
          op de eerste van de maand.
        </AppText>
        <ErrorText message={error} />
      </Screen>
    );
  }

  const partnerId = partner?.id ?? '';
  const mine = shiftsFor(rows, me.id, month);
  const theirs = shiftsFor(rows, partnerId, month);
  const partnerRow = rows.find((r) => r.user_id === partnerId && r.month === month);
  const myRow = rows.find((r) => r.user_id === me.id && r.month === month);
  const low = lowScales(rows, month);

  return (
    <Screen>
      <AppText variant="title">Hoe gaat het met ons?</AppText>
      <AppText muted>
        Check-in van {monthName(month)}. {partnerRow ? '' : `${partnerName} heeft nog niet ingevuld. Je ziet het zodra dat gebeurt. `}
        Je ziet alleen wat er veranderde ten opzichte van vorige maand.
      </AppText>
      {SCALES.map((s) => (
        <Card key={s.key}>
          <AppText variant="large">{s.label}</AppText>
          <AppText>Jij: {mine[s.key] ?? 'eerste keer'}</AppText>
          {partnerRow ? (
            <AppText>
              {partnerName}: {theirs[s.key] ?? 'eerste keer'}
            </AppText>
          ) : null}
          {low.includes(s.key) && (
            <View style={{ gap: spacing.xs }}>
              <AppText color={colors.secondary}>Wil je hier meer over praten? Deze oefeningen kunnen helpen.</AppText>
              <Row wrap>
                {s.exercises.map((slug) => (
                  <Button
                    key={slug}
                    kind="ghost"
                    label={titles[slug] ?? 'Naar de oefening'}
                    accessibilityLabel={`Oefening: ${titles[slug] ?? slug}`}
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: '/oefeningen/[slug]', params: { slug } })}
                  />
                ))}
              </Row>
            </View>
          )}
        </Card>
      ))}
      {(myRow?.wish || partnerRow?.wish) && (
        <Card tone="alt">
          <AppText variant="large">{WISH_QUESTION}</AppText>
          {myRow?.wish ? <AppText>Jij: {myRow.wish}</AppText> : null}
          {partnerRow?.wish ? (
            <AppText>
              {partnerName}: {partnerRow.wish}
            </AppText>
          ) : null}
        </Card>
      )}
      {low.length > 0 && <HelpLink />}
      <ErrorText message={error} />
    </Screen>
  );
}
