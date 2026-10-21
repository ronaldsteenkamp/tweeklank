import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText, Card, ErrorText, Loading, Pill, Row, Screen } from '@/components/ui';
import { fetchQuiz, fetchQuizResult, type QuizDetail } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { scoreMessage, summarize, type QuizResultRow } from '@/lib/quiz';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function QuizResultaat() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { partner } = useSession();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [rows, setRows] = useState<QuizResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const partnerName = partner?.display_name || 'Je partner';

  useEffect(() => {
    (async () => {
      try {
        const q = await fetchQuiz(String(slug));
        setQuiz(q);
        setRows(await fetchQuizResult(q.id));
      } catch (e) {
        setError(friendlyError(e));
      }
    })();
  }, [slug]);

  if (error) return <Screen><ErrorText message={error} /></Screen>;
  if (!quiz || !rows) return <Loading />;

  const s = summarize(rows);

  return (
    <Screen>
      <Stack.Screen options={{ title: quiz.title }} />
      <Card tone="alt">
        <AppText variant="label" color={colors.secondary}>
          Uitslag
        </AppText>
        <Row gap={spacing.lg}>
          <Score label="Jij raadde" score={s.myScore} total={s.total} />
          <Score label={`${partnerName} raadde`} score={s.partnerScore} total={s.total} />
        </Row>
        <AppText>{scoreMessage(s.myScore, s.total)}</AppText>
        <AppText variant="small" muted>
          Jullie kozen bij {s.same.length} van de {s.total} vragen hetzelfde.
        </AppText>
      </Card>

      {s.different.length > 0 && (
        <>
          <AppText variant="large" style={{ marginTop: spacing.sm }}>
            Waar jullie verschillen
          </AppText>
          <AppText variant="small" muted>
            Mooie gespreksstof: waarom kozen jullie zo?
          </AppText>
          {s.different.map((r) => (
            <ResultCard key={r.question_id} row={r} partnerName={partnerName} />
          ))}
        </>
      )}

      {s.same.length > 0 && (
        <>
          <AppText variant="large" style={{ marginTop: spacing.sm }}>
            Waar jullie hetzelfde over denken
          </AppText>
          {s.same.map((r) => (
            <ResultCard key={r.question_id} row={r} partnerName={partnerName} />
          ))}
        </>
      )}
    </Screen>
  );
}

function Score({ label, score, total }: { label: string; score: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label} ${score} van de ${total} goed`}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="display" color={colors.primary}>
        {score}/{total}
      </AppText>
    </View>
  );
}

function ResultCard({ row, partnerName }: { row: QuizResultRow; partnerName: string }) {
  const same = row.my_self === row.partner_self;
  const iGuessed = row.my_guess === row.partner_self;
  const theyGuessed = row.partner_guess === row.my_self;
  return (
    <Card>
      <AppText variant="large">{row.prompt}</AppText>
      <AppText>
        <AppText variant="label">Jij: </AppText>
        {row.options[row.my_self]}
      </AppText>
      <AppText>
        <AppText variant="label">{partnerName}: </AppText>
        {row.options[row.partner_self]}
      </AppText>
      <Row wrap>
        {same && <Pill label="Zelfde keuze" tone="secondary" />}
        {iGuessed && <Pill label="Jij raadde het goed" />}
        {theyGuessed && <Pill label={`${partnerName} raadde het goed`} />}
      </Row>
      {!iGuessed && (
        <AppText variant="small" muted>
          Jij gokte: {row.options[row.my_guess]}
        </AppText>
      )}
      {!theyGuessed && (
        <AppText variant="small" muted>
          {partnerName} gokte: {row.options[row.partner_guess]}
        </AppText>
      )}
    </Card>
  );
}
