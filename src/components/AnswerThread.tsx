import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { addReaction, removeReaction } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import type { Answer, Profile } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button, Card, ErrorText, Field, Row } from './ui';

export const REACTIONS: { emoji: string; label: string }[] = [
  { emoji: '❤️', label: 'Liefde' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '🥹', label: 'Ontroerd' },
  { emoji: '🙌', label: 'Helemaal mee eens' },
  { emoji: '🤔', label: 'Daar wil ik meer over horen' },
  { emoji: '🫶', label: 'Dank je' },
];

const labelFor = (emoji: string) => REACTIONS.find((r) => r.emoji === emoji)?.label ?? emoji;

function timeNl(iso: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(iso));
}

type Props = {
  answers: Answer[];
  me: Profile;
  partner: Profile | null;
  onChanged: () => void;
  onEditOwn?: () => void;
};

export function AnswerThread({ answers, me, partner, onChanged, onEditOwn }: Props) {
  const mine = answers.find((a) => a.user_id === me.id);
  const theirs = answers.find((a) => a.user_id !== me.id);
  const partnerName = partner?.display_name || 'Je partner';

  return (
    <View style={{ gap: spacing.md }}>
      {mine ? (
        <AnswerCard answer={mine} author="Jij" me={me} partnerName={partnerName} onChanged={onChanged} onEdit={onEditOwn} />
      ) : (
        <Card tone="alt">
          <AppText muted>Je hebt deze dag niet geantwoord. Het antwoord van {partnerName} blijft daarom verborgen.</AppText>
        </Card>
      )}
      {theirs ? (
        <AnswerCard answer={theirs} author={partnerName} me={me} partnerName={partnerName} onChanged={onChanged} canReact />
      ) : mine ? (
        <Card tone="alt">
          <AppText muted>{partnerName} heeft nog niet geantwoord. Je krijgt het te zien zodra dat gebeurt.</AppText>
        </Card>
      ) : null}
    </View>
  );
}

function AnswerCard({
  answer,
  author,
  me,
  partnerName,
  onChanged,
  onEdit,
  canReact,
}: {
  answer: Answer;
  author: string;
  me: Profile;
  partnerName: string;
  onChanged: () => void;
  onEdit?: () => void;
  canReact?: boolean;
}) {
  const { colors } = useTheme();
  const reactions = [...answer.answer_reactions].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const confirmRemove = (id: number) =>
    Alert.alert('Reactie verwijderen?', undefined, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => removeReaction(id).then(onChanged).catch((e) => Alert.alert(friendlyError(e))),
      },
    ]);

  return (
    <Card>
      <Row>
        <AppText variant="label" color={colors.primary} style={{ flex: 1 }}>
          {author}
        </AppText>
        <AppText variant="small" muted>
          {timeNl(answer.created_at)}
        </AppText>
      </Row>
      <AppText selectable>{answer.body}</AppText>

      {reactions.length > 0 && (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {reactions.map((r) => {
            const own = r.user_id === me.id;
            const who = own ? 'Jij' : partnerName;
            const text = [r.emoji, r.message].filter(Boolean).join('  ');
            return (
              <Pressable
                key={r.id}
                onLongPress={own ? () => confirmRemove(r.id) : undefined}
                accessibilityRole={own ? 'button' : 'text'}
                accessibilityActions={own ? [{ name: 'longpress', label: 'Verwijderen' }] : undefined}
                onAccessibilityAction={own ? () => confirmRemove(r.id) : undefined}
                accessibilityLabel={`${who} reageerde: ${r.emoji ? labelFor(r.emoji) : ''} ${r.message ?? ''}`}
                accessibilityHint={own ? 'Lang indrukken om te verwijderen' : undefined}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  maxWidth: '100%',
                }}
              >
                <AppText variant="small">
                  <AppText variant="label">{who}: </AppText>
                  {text}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      {onEdit && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button kind="ghost" label="Aanpassen" onPress={onEdit} accessibilityHint="Pas je antwoord van vandaag aan" />
        </View>
      )}
      {canReact && <ReactionBar answerId={answer.id} userId={me.id} onSent={onChanged} />}
    </Card>
  );
}

function ReactionBar({ answerId, userId, onSent }: { answerId: number; userId: string; onSent: () => void }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (emoji?: string) => {
    if (!emoji && !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addReaction({ answerId, userId, emoji, message: emoji ? undefined : message });
      setMessage('');
      onSent();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <Row wrap>
        {REACTIONS.map((r) => (
          <Pressable
            key={r.emoji}
            onPress={() => send(r.emoji)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Reageer met ${r.label}`}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <AppText variant="large">{r.emoji}</AppText>
          </Pressable>
        ))}
      </Row>
      <Field
        label="Kort berichtje"
        placeholder="Reageer op dit antwoord…"
        value={message}
        onChangeText={setMessage}
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={() => send()}
      />
      {message.trim().length > 0 && <Button kind="secondary" label="Verstuur reactie" onPress={() => send()} busy={busy} />}
      <ErrorText message={error} />
    </View>
  );
}
