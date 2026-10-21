import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { fetchMyQuizResponses, fetchQuiz, fetchQuizOverview, saveQuizResponse, type QuizDetail } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { nextStep, type QuizKind } from '@/lib/quiz';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Response = { question_id: number; kind: QuizKind; option_index: number };

export default function QuizInvullen() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { me, partner, coupleId } = useSession();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [pos, setPos] = useState<{ kind: QuizKind; index: number } | null>(null);
  const [done, setDone] = useState(false);
  const [partnerDone, setPartnerDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerName = partner?.display_name || 'je partner';

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const q = await fetchQuiz(String(slug));
      const [mine, overview] = await Promise.all([fetchMyQuizResponses(q.id, me.id), fetchQuizOverview()]);
      setQuiz(q);
      setResponses(mine);
      setPartnerDone(!!overview.find((o) => o.slug === q.slug)?.partner_done);
      const step = nextStep(q.quiz_questions.map((x) => x.id), mine);
      setPos(step);
      setDone(step === null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [slug, me]);

  useEffect(() => {
    load();
  }, [load]);

  const questionIds = useMemo(() => quiz?.quiz_questions.map((q) => q.id) ?? [], [quiz]);

  if (error && !quiz) return <Screen><ErrorText message={error} /></Screen>;
  if (!quiz || !me || !coupleId) return <Loading />;

  if (done) {
    return (
      <Screen>
        <Stack.Screen options={{ title: quiz.title }} />
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <AppText variant="title">{partnerDone ? 'Jullie zijn allebei klaar!' : 'Klaar!'}</AppText>
          <AppText muted>
            {partnerDone
              ? 'Benieuwd hoe goed jullie elkaar kennen?'
              : `Zodra ${partnerName} de quiz ook heeft ingevuld, zien jullie de uitslag.`}
          </AppText>
          {partnerDone ? (
            <Button label="Bekijk de uitslag" onPress={() => router.replace({ pathname: '/quiz/[slug]/resultaat', params: { slug: quiz.slug } })} />
          ) : (
            <Button kind="secondary" label="Terug naar de quizzen" onPress={() => router.back()} />
          )}
        </View>
      </Screen>
    );
  }

  if (!pos) return <Loading />;
  const question = quiz.quiz_questions[pos.index];
  const current = responses.find((r) => r.kind === pos.kind && r.question_id === question.id)?.option_index;
  const stepNumber = pos.index + 1;
  const total = quiz.quiz_questions.length;
  const isLast = pos.kind === 'guess' && responses.length === total * 2 - 1 && current === undefined;

  const choose = async (optionIndex: number) => {
    setSaving(true);
    setError(null);
    try {
      await saveQuizResponse({ coupleId, userId: me.id, quizId: quiz.id, questionId: question.id, kind: pos.kind, optionIndex });
      const updated = [
        ...responses.filter((r) => !(r.kind === pos.kind && r.question_id === question.id)),
        { question_id: question.id, kind: pos.kind, option_index: optionIndex },
      ];
      setResponses(updated);
      const step = nextStep(questionIds, updated);
      if (step === null) await load();
      else setPos(step);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (pos.index > 0) setPos({ kind: pos.kind, index: pos.index - 1 });
    else if (pos.kind === 'guess') setPos({ kind: 'self', index: total - 1 });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: quiz.title }} />
      <AppText variant="label" color={colors.secondary}>
        {pos.kind === 'self' ? `Over jou · ${stepNumber}/${total}` : `Raad wat ${partnerName} koos · ${stepNumber}/${total}`}
      </AppText>
      <ProgressBar value={(pos.kind === 'self' ? 0 : total) + pos.index} max={total * 2} />

      <Card tone="alt">
        {pos.kind === 'guess' && (
          <AppText variant="label" muted>
            Wat zou {partnerName} antwoorden?
          </AppText>
        )}
        <AppText variant="title">{pos.kind === 'guess' ? `“${question.prompt}”` : question.prompt}</AppText>
      </Card>

      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        {question.options.map((option, i) => {
          const selected = current === i;
          return (
            <Pressable
              key={option}
              onPress={() => choose(i)}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving }}
              accessibilityLabel={option}
              style={({ pressed }) => ({
                minHeight: 54,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : pressed ? colors.surfaceAlt : colors.surface,
              })}
            >
              <AppText color={selected ? colors.onPrimary : colors.text}>{option}</AppText>
            </Pressable>
          );
        })}
      </View>

      {pos.kind === 'guess' && pos.index === 0 && (
        <AppText variant="small" muted>
          Tip: na je laatste gok liggen al je antwoorden vast.
        </AppText>
      )}
      {isLast && (
        <AppText variant="small" muted>
          Dit is de laatste vraag. Daarna kun je niets meer wijzigen.
        </AppText>
      )}
      <ErrorText message={error} />
      {(pos.index > 0 || pos.kind === 'guess') && <Button kind="ghost" label="Vorige vraag" onPress={back} />}
    </Screen>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max, now: value }}
      style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.round((value / max) * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}
