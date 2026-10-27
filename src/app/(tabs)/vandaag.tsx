import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnswerThread } from '@/components/AnswerThread';
import { NudgeButton } from '@/components/NudgeButton';
import { RecoveryCard } from '@/components/RecoveryCard';
import { SeriesOfferCard } from '@/components/SeriesOfferCard';
import { SoloCard } from '@/components/SoloCard';
import { YearAgo } from '@/components/YearAgo';
import { YesterdayCard } from '@/components/YesterdayCard';
import { AppText, Button, Card, DEPTH_LABEL, ErrorText, Field, Loading, Pill, Row } from '@/components/ui';
import {
  dismissSoloCard,
  fetchAnswers,
  fetchCheckinOpenMonth,
  fetchCheckins,
  fetchCoupleStart,
  fetchImportantDates,
  fetchSeriesOffer,
  fetchSoloCardDue,
  fetchToday,
  fetchWeek,
  fetchYearAgo,
  fetchYesterday,
  saveAnswer,
  updateProfile,
} from '@/lib/api';
import { yesterdayView, type YesterdayQuestion } from '@/lib/catchup';
import { formatDayNl } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { anniversaryToday } from '@/lib/ourYear';
import { pauseLabel, streakLabel, weekLabel, type WeekStatus } from '@/lib/rhythm';
import { showRecoveryCard } from '@/lib/recovery';
import { nextReunion, reunionLabel } from '@/lib/together';
import { isSeriesFinale, seriesLabel, type SeriesOffer } from '@/lib/series';
import { useSession } from '@/lib/session';
import { isPhoneOnlyAccount } from '@/lib/transfer';
import type { Answer, TodayQuestion } from '@/lib/types';
import { useCoupleRealtime } from '@/lib/useCoupleRealtime';
import type { YearAgoAnswer } from '@/lib/yearAgo';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function Vandaag() {
  const { colors } = useTheme();
  const { session, me, partner, coupleId, refresh } = useSession();
  const [today, setToday] = useState<TodayQuestion | null>(null);
  const [week, setWeek] = useState<WeekStatus | null>(null);
  const [yesterday, setYesterday] = useState<YesterdayQuestion | null>(null);
  const [yesterdayAnswers, setYesterdayAnswers] = useState<Answer[]>([]);
  const [yearAgo, setYearAgo] = useState<YearAgoAnswer[]>([]);
  const [offers, setOffers] = useState<SeriesOffer[]>([]);
  const [solo, setSolo] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [reunion, setReunion] = useState<{ title: string; days: number } | null>(null);
  const [anniversary, setAnniversary] = useState(0);
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
      // Alles naast de vraag van vandaag is een extra: als iets (nog) niet laadt, werkt de vraag gewoon
      const [a, w, y, ago, o, s, dates, month, checkins, start] = await Promise.all([
        fetchAnswers(q.day),
        fetchWeek().catch(() => null),
        fetchYesterday().catch(() => null),
        q.repeat_of && q.answered ? fetchYearAgo(q.day).catch(() => []) : Promise.resolve([]),
        fetchSeriesOffer().catch(() => []),
        fetchSoloCardDue().catch(() => false),
        fetchImportantDates().catch(() => []),
        fetchCheckinOpenMonth().catch(() => null),
        fetchCheckins().catch(() => []),
        fetchCoupleStart().catch(() => null),
      ]);
      setAnswers(a);
      setWeek(w);
      setYesterday(y);
      setYesterdayAnswers(y && yesterdayView(y) === 'ingehaald' ? await fetchAnswers(y.day) : []);
      setYearAgo(ago);
      setOffers(o);
      setSolo(s);
      setReunion(nextReunion(dates, q.day));
      setCheckinOpen(!!month && !checkins.some((c) => c.month === month && c.user_id === me?.id));
      setAnniversary(start ? anniversaryToday(start, q.day) : 0);
      setError(null);
    } catch (e) {
      // Partner heeft ontkoppeld: sessie verversen, dan stuurt de tab-layout je terug naar koppelen.
      if (String((e as { message?: string })?.message).includes('geen_partner')) await refresh();
      else setError(friendlyError(e));
    }
  }, [refresh, me?.id]);

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
        {anniversary > 0 && (
          <Card tone="alt">
            <AppText variant="large">
              Vandaag {anniversary === 1 ? 'een jaar' : `${anniversary} jaar`} samen in Tweeklank
            </AppText>
            <Button kind="secondary" label="Bekijk ons jaar" onPress={() => router.push('/ons-jaar')} />
          </Card>
        )}
        {reunion && (
          <Card tone="alt">
            <AppText variant="large" color={colors.primary}>
              {reunionLabel(reunion.days)}
            </AppText>
            <AppText variant="small" muted>
              {reunion.title}
            </AppText>
          </Card>
        )}
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

        {me && showRecoveryCard({ phoneOnly: isPhoneOnlyAccount(session?.user), createdAt: session?.user.created_at, seen: me.recovery_card_seen }) && (
          <RecoveryCard
            onLater={() => {
              updateProfile(me.id, { recovery_card_seen: true })
                .then(refresh)
                .catch(() => {});
            }}
          />
        )}
        {checkinOpen && (
          <Card>
            <AppText variant="large">Hoe gaat het met ons?</AppText>
            <AppText muted>De check-in van deze maand staat klaar. Het kost een paar minuten.</AppText>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button kind="secondary" label="Naar de check-in" onPress={() => router.push('/checkin')} />
            </View>
          </Card>
        )}
        {coupleId && (
          <YesterdayCard
            yesterday={yesterday}
            answers={yesterdayAnswers}
            me={me}
            partner={partner}
            coupleId={coupleId}
            onChanged={load}
          />
        )}

        <Card tone="alt">
          <AppText variant="label" color={colors.secondary}>
            {today.series_title && today.series_step
              ? seriesLabel(today.series_title, today.series_step)
              : `Vraag van vandaag · ${DEPTH_LABEL[today.depth]}`}
          </AppText>
          {today.series_step === 1 && today.series_intro ? <AppText muted>{today.series_intro}</AppText> : null}
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
        {!showForm && yearAgo.length > 0 && <YearAgo answers={yearAgo} today={today.day} partnerName={partnerName} />}
        {!showForm && isSeriesFinale(today.series_step, today.series_exercise_slug) && (
          <Card tone="alt">
            <AppText variant="large">Afsluiting van de themaweek</AppText>
            <AppText>Sluit de week samen af met een korte oefening, wanneer het jullie uitkomt.</AppText>
            <Button
              kind="secondary"
              label="Naar de oefening"
              onPress={() => router.push({ pathname: '/oefeningen/[slug]', params: { slug: today.series_exercise_slug ?? '' } })}
            />
          </Card>
        )}
        {!showForm && <SeriesOfferCard offers={offers} partnerName={partnerName} onChanged={load} />}
        {solo && (
          <SoloCard
            onDismiss={() => {
              setSolo(false);
              dismissSoloCard().catch(() => {});
            }}
          />
        )}
        <NudgeButton partnerName={partnerName} />
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
