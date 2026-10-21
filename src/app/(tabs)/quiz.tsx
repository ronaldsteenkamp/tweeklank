import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, ErrorText, Pill, Row, Screen } from '@/components/ui';
import { fetchQuizOverview, type QuizOverview } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { quizStatus } from '@/lib/quiz';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function QuizLijst() {
  const { colors } = useTheme();
  const { partner } = useSession();
  const [quizzes, setQuizzes] = useState<QuizOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const partnerName = partner?.display_name || 'je partner';

  useFocusEffect(
    useCallback(() => {
      fetchQuizOverview()
        .then((q) => {
          setQuizzes(q);
          setError(null);
        })
        .catch((e) => setError(friendlyError(e)));
    }, []),
  );

  const label = (q: QuizOverview) => {
    switch (quizStatus(q.my_progress, q.question_count, q.partner_done)) {
      case 'nieuw':
        return q.partner_done ? `${partnerName} is al klaar · Begin` : 'Begin';
      case 'bezig':
        return `Ga verder (${q.my_progress}/${q.question_count * 2})`;
      case 'wachten':
        return `Wacht op ${partnerName}`;
      case 'klaar':
        return `Jij ${q.my_score}/${q.question_count} · ${partnerName} ${q.partner_score}/${q.question_count}`;
    }
  };

  const open = (q: QuizOverview) => {
    const done = quizStatus(q.my_progress, q.question_count, q.partner_done) === 'klaar';
    router.push({ pathname: done ? '/quiz/[slug]/resultaat' : '/quiz/[slug]', params: { slug: q.slug } });
  };

  return (
    <Screen>
      <AppText variant="title">Hoe goed ken je me?</AppText>
      <AppText muted>
        Beantwoord eerst tien vragen over jezelf en raad daarna wat {partnerName} koos. De uitslag zien jullie als jullie
        allebei klaar zijn.
      </AppText>
      <ErrorText message={error} />
      {(quizzes ?? []).map((q) => (
        <Pressable
          key={q.slug}
          onPress={() => open(q)}
          accessibilityRole="button"
          accessibilityLabel={`${q.title}. ${label(q)}`}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.sm,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <AppText variant="large">{q.title}</AppText>
          <AppText variant="small" muted>
            {q.description}
          </AppText>
          <View style={{ marginTop: spacing.xs }}>
            <Row>
              <Pill
                label={label(q)}
                tone={quizStatus(q.my_progress, q.question_count, q.partner_done) === 'klaar' ? 'secondary' : 'accent'}
              />
            </Row>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
