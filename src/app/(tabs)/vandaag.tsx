import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnswerThread } from '@/components/AnswerThread';
import { AppText, Button, Card, DEPTH_LABEL, ErrorText, Field, Loading, Pill, Row } from '@/components/ui';
import { fetchAnswers, fetchToday, fetchWeek, saveAnswer } from '@/lib/api';
import { formatDayNl } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { pauseLabel, streakLabel, weekLabel, type WeekStatus } from '@/lib/rhythm';
import { useSession } from '@/lib/session';
import type { Answer, TodayQuestion } from '@/lib/types';
import { useCoupleRealtime } from '@/lib/useCoupleRealtime';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Vandaag() {
  const { colors } = useTheme();
  const { me, partner, coupleId, refresh } = useSession();
  const [today, setToday] = useState<TodayQuestion | null>(null);
  const [week, setWeek] = useState<WeekStatus | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = await fetchToday();
      setToday(q);
      const [a, w] = await Promise.all([fetchAnswers(q.day), fetchWeek()]);
      setAnswers(a);
      setWeek(w);
      setError(null);
    } catch (e) {
      // Partner heeft ontkoppeld: sessie verversen, dan stuurt de tab-layout je terug naar koppelen.
      if (String((e as { message?: string })?.message).includes('geen_partner')) await refresh();
      else setError(friendlyError(e));
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useCoupleRealtime(coupleId, load);

  if (!me) return <Loading />;
  if (!today) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }}>
        {error ? (
          <>
            <ErrorText message={error} />
            <Button label="Opnieuw proberen" onPress={load} />
          </>
        ) : (
          <Loading />
        )}
      </SafeAreaView>
    );
  }

  const mine = answers.find((a) => a.user_id === me.id);
  const partnerName = partner?.display_name || 'Je partner';
  const showForm = !today.answered || editing;

  const submit = async () => {
    if (!coupleId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveAnswer({ coupleId, userId: me.id, day: today.day, body: draft, existingId: editing ? mine?.id : undefined });
      setDraft('');
      setEditing(false);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <AppText variant="label" muted>
          {formatDayNl(today.day).toUpperCase()}
        </AppText>
        {week && <WeekRhythm week={week} />}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            kind="ghost"
            label="Archief: eerdere vragen"
            onPress={() => router.push('/archief')}
            accessibilityHint="Bekijk alle eerdere vragen en antwoorden"
          />
        </View>

        <Card tone="alt">
          <AppText variant="label" color={colors.secondary}>
            Vraag van vandaag · {DEPTH_LABEL[today.depth]}
          </AppText>
          <AppText variant="title">{today.text}</AppText>
        </Card>

        {showForm ? (
          <View style={{ gap: spacing.md }}>
            {!today.answered && today.partner_answered && (
              <AppText color={colors.secondary} accessibilityLiveRegion="polite">
                {partnerName} heeft al geantwoord. Geef jouw antwoord om dat van {partnerName} te lezen.
              </AppText>
            )}
            {!today.answered && !today.partner_answered && (
              <AppText muted>
                Jullie zien elkaars antwoord pas als jullie allebei hebben geantwoord.
              </AppText>
            )}
            <Field
              label={editing ? 'Pas je antwoord aan' : 'Jouw antwoord'}
              multiline
              value={draft}
              onChangeText={setDraft}
              maxLength={2000}
              placeholder="Schrijf wat er in je opkomt…"
            />
            <Button label={editing ? 'Opslaan' : 'Antwoord delen'} onPress={submit} disabled={!draft.trim()} busy={busy} />
            {editing && <Button kind="ghost" label="Annuleren" onPress={() => setEditing(false)} />}
          </View>
        ) : (
          <AnswerThread
            answers={answers}
            me={me}
            partner={partner}
            onChanged={load}
            onEditOwn={() => {
              setDraft(mine?.body ?? '');
              setEditing(true);
            }}
          />
        )}
        <ErrorText message={error} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekRhythm({ week }: { week: WeekStatus }) {
  const streak = streakLabel(week.streak);
  const pause = pauseLabel(week);
  return (
    <View style={{ gap: spacing.xs }} accessible accessibilityLabel={[week.week_paused ? null : weekLabel(week), streak, pause].filter(Boolean).join('. ')}>
      <Row wrap>
        {!week.week_paused && <Pill label={weekLabel(week)} />}
        {streak && <Pill label={streak} tone="secondary" />}
      </Row>
      {pause && (
        <AppText variant="small" muted>
          {pause}
        </AppText>
      )}
    </View>
  );
}
