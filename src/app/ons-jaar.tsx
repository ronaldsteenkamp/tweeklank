import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import {
  fetchArchive,
  fetchCoupleStart,
  fetchFavoriteCardTexts,
  fetchPlans,
  fetchQuizOverview,
  fetchYearConsents,
  setYearConsent,
} from '@/lib/api';
import { amsterdamDay, formatDayNl } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { buildOurYear, yearPeriod, type OurYear, type YearPeriod } from '@/lib/ourYear';
import { useSession } from '@/lib/session';
import { CAN_SHARE_IMAGE, shareViewAsImage } from '@/lib/shareImage';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// Volledig op het toestel gemaakt, uit wat jullie al konden zien. Delen als afbeelding alleen als
// jullie allebei toestemming geven voor dit overzicht.
export default function OnsJaar() {
  const { colors } = useTheme();
  const { me, partner, coupleId } = useSession();
  const [period, setPeriod] = useState<YearPeriod | null>(null);
  const [year, setYear] = useState<OurYear | null>(null);
  const [consents, setConsents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shotRef = useRef<ComponentRef<typeof View>>(null);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const start = await fetchCoupleStart();
      if (!start) return;
      const p = yearPeriod(start, amsterdamDay());
      const [archive, plans, quizzes, favorites, c] = await Promise.all([
        fetchArchive(),
        fetchPlans(),
        fetchQuizOverview(),
        fetchFavoriteCardTexts(),
        fetchYearConsents(p.start),
      ]);
      setPeriod(p);
      setYear(buildOurYear({ period: p, meId: me.id, archive, plans, quizzes, favorites }));
      setConsents(c);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [me]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!me || (!year && !error)) return <Loading />;
  if (!year || !period) return <Screen><ErrorText message={error} /></Screen>;

  const partnerName = partner?.display_name || 'Je partner';
  const iAgree = consents.includes(me.id);
  const theyAgree = !!partner && consents.includes(partner.id);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleConsent = () =>
    run(async () => {
      if (!coupleId) return;
      await setYearConsent({ coupleId, userId: me.id, periodStart: period.start, on: !iAgree });
      setConsents(await fetchYearConsents(period.start));
    });

  return (
    <Screen>
      <View ref={shotRef} collapsable={false} style={{ gap: spacing.md, backgroundColor: colors.background, paddingVertical: spacing.sm }}>
        <AppText variant="title">{period.label}</AppText>
        <AppText muted>
          {formatDayNl(period.start)} tot en met {formatDayNl(period.end)}
        </AppText>

        <Card tone="alt">
          <AppText variant="display" color={colors.primary}>
            {year.togetherDays}
          </AppText>
          <AppText variant="large">{year.togetherDays === 1 ? 'samen-dag' : 'samen-dagen'}</AppText>
        </Card>

        {year.heartDays.length > 0 && (
          <Card>
            <AppText variant="large">Allebei een hartje</AppText>
            {year.heartDays.map((d) => (
              <View key={d.day} style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                <AppText variant="label" color={colors.secondary}>
                  {d.question}
                </AppText>
                {d.answers.map((a) => (
                  <AppText key={`${d.day}-${a.mine}`}>
                    <AppText variant="label">{a.mine ? 'Jij' : partnerName}: </AppText>
                    {a.body}
                  </AppText>
                ))}
              </View>
            ))}
          </Card>
        )}

        {year.donePlans.length > 0 && (
          <Card>
            <AppText variant="large">Samen gedaan</AppText>
            {year.donePlans.map((t, i) => (
              <AppText key={`${t}-${i}`}>✓ {t}</AppText>
            ))}
          </Card>
        )}

        {year.bestQuiz && (
          <Card>
            <AppText variant="large">Jullie beste quiz</AppText>
            <AppText>
              {year.bestQuiz.title}: samen {year.bestQuiz.correct} van {year.bestQuiz.total} goed geraden
            </AppText>
          </Card>
        )}

        {year.favorites.length > 0 && (
          <Card>
            <AppText variant="large">Favoriete kaarten</AppText>
            {year.favorites.map((t) => (
              <AppText key={t}>♥ {t}</AppText>
            ))}
          </Card>
        )}
      </View>

      <Card>
        <AppText variant="large">Delen als afbeelding</AppText>
        <AppText variant="small" muted>
          Dit overzicht is alleen voor jullie. Delen kan pas als jullie het allebei goed vinden, voor dit overzicht.
        </AppText>
        <AppText color={colors.secondary} accessibilityLiveRegion="polite">
          {iAgree && theyAgree
            ? 'Jullie vinden het allebei goed.'
            : iAgree
              ? `Wacht op ${partnerName}.`
              : theyAgree
                ? `${partnerName} vindt delen goed.`
                : 'Nog niemand heeft toestemming gegeven.'}
        </AppText>
        <Button kind="secondary" label={iAgree ? 'Toestemming intrekken' : 'Ik vind delen goed'} onPress={toggleConsent} busy={busy} />
        {CAN_SHARE_IMAGE ? (
          <Button
            label="Deel als afbeelding"
            onPress={() => run(() => shareViewAsImage(shotRef))}
            disabled={!(iAgree && theyAgree) || busy}
          />
        ) : (
          <AppText variant="small" muted>
            Delen als afbeelding kan in de app, niet in de browser.
          </AppText>
        )}
      </Card>
      <ErrorText message={error} />
    </Screen>
  );
}
