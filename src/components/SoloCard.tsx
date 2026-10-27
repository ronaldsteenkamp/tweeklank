import { View } from 'react-native';
import { SOLO_OPENER, SOLO_OPENER_INTRO, SOLO_PARAGRAPHS, SOLO_SOURCE, SOLO_TITLE } from '@/lib/solo';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { HelpLink } from './HelpLink';
import { AppText, Button, Card } from './ui';

// Alleen in de app, alleen voor de actieve partner. Geen aantallen, geen datums.
export function SoloCard({ onDismiss }: { onDismiss: () => void }) {
  const { colors } = useTheme();
  return (
    <Card tone="alt">
      <AppText variant="large">{SOLO_TITLE}</AppText>
      {SOLO_PARAGRAPHS.map((p) => (
        <AppText key={p}>{p}</AppText>
      ))}
      <AppText>{SOLO_OPENER_INTRO}</AppText>
      <AppText variant="large" color={colors.primary}>
        “{SOLO_OPENER}”
      </AppText>
      <AppText variant="small" muted>
        {SOLO_SOURCE}
      </AppText>
      <View style={{ alignSelf: 'flex-start', gap: spacing.xs }}>
        <Button kind="secondary" label="Wegklikken" onPress={onDismiss} accessibilityHint="Deze kaart komt hoogstens over twee weken terug" />
      </View>
      <HelpLink />
    </Card>
  );
}
