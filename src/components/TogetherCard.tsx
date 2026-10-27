import { useState } from 'react';
import { View } from 'react-native';
import { endCardSession, showCardTogether } from '@/lib/api';
import { randomCard, stepCard } from '@/lib/cardSession';
import type { CardQuestion } from '@/lib/cards';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Button, DEPTH_LABEL, ErrorText, Row } from './ui';

// Samen spelen: jullie zien allebei dezelfde kaart. Wie verder tikt, neemt de ander mee.
export function TogetherCard({ question, cards, partnerName }: { question: CardQuestion | undefined; cards: CardQuestion[]; partnerName: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const go = (id: number | null) => id !== null && run(() => showCardTogether(id));

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <AppText variant="label" color={colors.secondary}>
        Jullie spelen samen · {partnerName} ziet dezelfde kaart
      </AppText>
      <View
        style={{
          minHeight: 240,
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          borderWidth: 1.5,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        {question ? (
          <>
            <AppText variant="label" color={colors.secondary}>
              {DEPTH_LABEL[question.depth]}
            </AppText>
            <AppText variant="title" accessibilityRole="text" accessibilityLiveRegion="polite">
              {question.text}
            </AppText>
          </>
        ) : (
          <AppText muted>Deze kaart is niet (meer) zichtbaar.</AppText>
        )}
      </View>
      <Row wrap>
        <View style={{ flexGrow: 1 }}>
          <Button kind="secondary" label="Vorige" onPress={() => go(stepCard(cards, question?.id ?? -1, -1))} disabled={busy} />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label="Volgende" onPress={() => go(stepCard(cards, question?.id ?? -1, 1))} disabled={busy} />
        </View>
      </Row>
      <Button kind="secondary" label="Schud" onPress={() => go(randomCard(cards, question?.id ?? -1))} disabled={busy} accessibilityHint="Kies samen een willekeurige kaart" />
      <Button kind="ghost" label="Stoppen met samen spelen" onPress={() => run(endCardSession)} disabled={busy} accessibilityHint="Wist de sessie voor jullie allebei" />
      <AppText variant="small" muted>
        De sessie stopt vanzelf na twee uur. Er wordt niets bewaard.
      </AppText>
      <ErrorText message={error} />
    </View>
  );
}
