import { useState } from 'react';
import { View } from 'react-native';
import { saveAnswer } from '@/lib/api';
import { yesterdayView, type YesterdayQuestion } from '@/lib/catchup';
import { friendlyError } from '@/lib/errors';
import type { Answer, Profile } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { AnswerThread } from './AnswerThread';
import { AppText, Button, Card, DEPTH_LABEL, ErrorText, Field } from './ui';

type Props = {
  yesterday: YesterdayQuestion | null;
  answers: Answer[];
  me: Profile;
  partner: Profile | null;
  coupleId: string;
  onChanged: () => void;
};

// Rustige kaart boven de vraag van vandaag: de vraag van gisteren kan nog tot het einde van vandaag.
export function YesterdayCard({ yesterday, answers, me, partner, coupleId, onChanged }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = yesterdayView(yesterday);
  if (!yesterday || !view) return null;

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveAnswer({ coupleId, userId: me.id, day: yesterday.day, body: draft });
      setDraft('');
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <AppText variant="label" color={colors.secondary}>
        {view === 'open' ? 'Gisteren nog open' : 'Gisteren ingehaald'} · {DEPTH_LABEL[yesterday.depth]}
      </AppText>
      <AppText variant="large">{yesterday.text}</AppText>
      {view === 'open' ? (
        open ? (
          <View style={{ gap: spacing.sm }}>
            <Field
              label="Jouw antwoord op gisteren"
              multiline
              value={draft}
              onChangeText={setDraft}
              maxLength={2000}
              placeholder="Schrijf wat er in je opkomt…"
            />
            <AppText variant="small" muted>
              Een ingehaald antwoord kun je daarna niet meer aanpassen.
            </AppText>
            <Button label="Antwoord delen" onPress={submit} disabled={!draft.trim()} busy={busy} />
            <Button kind="ghost" label="Later" onPress={() => setOpen(false)} />
          </View>
        ) : (
          <>
            <AppText variant="small" muted>
              Je kunt deze vraag nog tot het einde van vandaag beantwoorden.
            </AppText>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button kind="secondary" label="Nu beantwoorden" onPress={() => setOpen(true)} accessibilityHint="Beantwoord de vraag van gisteren" />
            </View>
          </>
        )
      ) : (
        <AnswerThread answers={answers} me={me} partner={partner} onChanged={onChanged} />
      )}
      <ErrorText message={error} />
    </Card>
  );
}
