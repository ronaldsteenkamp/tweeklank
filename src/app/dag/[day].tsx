import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { AnswerThread } from '@/components/AnswerThread';
import { AppText, Card, DEPTH_LABEL, ErrorText, Loading, Screen } from '@/components/ui';
import { fetchAnswers, fetchArchiveDay } from '@/lib/api';
import { relativeDayNl } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import type { Answer, ArchiveDay } from '@/lib/types';
import { useCoupleRealtime } from '@/lib/useCoupleRealtime';
import { useTheme } from '@/theme/ThemeProvider';

export default function Dag() {
  const { colors } = useTheme();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { me, partner, coupleId } = useSession();
  const [info, setInfo] = useState<ArchiveDay | null>(null);
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([fetchArchiveDay(String(day)), fetchAnswers(String(day))]);
      setInfo(d);
      setAnswers(a);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useCoupleRealtime(coupleId, load);

  if (error) return <Screen><ErrorText message={error} /></Screen>;
  if (!me || !answers || !info) return <Loading />;

  return (
    <Screen>
      <AppText variant="label" muted>
        {relativeDayNl(String(day))}
      </AppText>
      <Card tone="alt">
        <AppText variant="label" color={colors.secondary}>
          {DEPTH_LABEL[info.daily_questions.depth]}
        </AppText>
        <AppText variant="title">{info.daily_questions.text}</AppText>
      </Card>
      <AnswerThread answers={answers} me={me} partner={partner} onChanged={load} />
    </Screen>
  );
}
