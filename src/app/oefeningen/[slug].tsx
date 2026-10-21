import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText, Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { addCompletion, fetchCompletions, fetchExercise, removeCompletion } from '@/lib/api';
import { formatDayNl, amsterdamDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { CATEGORY_LABEL, minutesLabel, type Completion, type Exercise } from '@/lib/exercises';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function OefeningDetail() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { me, partner, coupleId } = useSession();
  const [exercise, setExercise] = useState<Exercise | null | undefined>(undefined);
  const [history, setHistory] = useState<Completion[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const e = await fetchExercise(String(slug));
      setExercise(e);
      if (e) setHistory(await fetchCompletions(e.id));
    } catch (err) {
      setError(friendlyError(err));
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (exercise === undefined && !error) return <Loading />;
  if (!exercise) return <Screen><ErrorText message={error ?? 'Deze oefening bestaat niet.'} /></Screen>;

  const save = async () => {
    if (!me || !coupleId) return;
    setBusy(true);
    setError(null);
    try {
      await addCompletion({ coupleId, userId: me.id, exerciseId: exercise.id, note });
      setNote('');
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (c: Completion) =>
    Alert.alert('Weghalen uit het logboek?', undefined, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Weghalen', style: 'destructive', onPress: () => removeCompletion(c.id).then(load).catch((e) => setError(friendlyError(e))) },
    ]);

  const who = (userId: string) => (userId === me?.id ? 'Jij' : partner?.display_name || 'Je partner');

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.title }} />
      <AppText variant="label" color={colors.secondary}>
        {CATEGORY_LABEL[exercise.category]} · {minutesLabel(exercise.minutes)}
      </AppText>
      <AppText variant="title">{exercise.title}</AppText>
      <AppText>{exercise.intro}</AppText>

      <Card>
        <AppText variant="large">Zo doe je het</AppText>
        {exercise.steps.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="label" color={colors.primary} style={{ minWidth: 22 }}>
              {i + 1}.
            </AppText>
            <AppText style={{ flex: 1 }}>{step}</AppText>
          </View>
        ))}
      </Card>

      <Card tone="alt">
        <AppText variant="large">Waarom dit helpt</AppText>
        <AppText>{exercise.why}</AppText>
      </Card>

      <Card>
        <AppText variant="large">Gedaan?</AppText>
        <Field label="Notitie (optioneel)" value={note} onChangeText={setNote} maxLength={500} placeholder="Hoe ging het?" multiline />
        <Button label="We hebben dit gedaan" onPress={save} busy={busy} />
        <ErrorText message={error} />
      </Card>

      {history.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="large">Logboek</AppText>
          {history.map((c) => {
            const day = amsterdamDay(new Date(c.completed_at));
            const own = c.user_id === me?.id;
            return (
              <Pressable
                key={c.id}
                onLongPress={own ? () => confirmRemove(c) : undefined}
                accessibilityRole={own ? 'button' : 'text'}
                accessibilityActions={own ? [{ name: 'longpress', label: 'Weghalen' }] : undefined}
                onAccessibilityAction={own ? () => confirmRemove(c) : undefined}
                accessibilityLabel={`${who(c.user_id)}, ${formatDayNl(day)}${c.note ? `: ${c.note}` : ''}`}
                accessibilityHint={own ? 'Lang indrukken om weg te halen' : undefined}
              >
                <Card>
                  <AppText variant="small" muted>
                    {who(c.user_id)} · {formatDayNl(day)}
                  </AppText>
                  {c.note ? <AppText>{c.note}</AppText> : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
