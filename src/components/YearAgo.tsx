import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { yearAgoTitle, type YearAgoAnswer } from '@/lib/yearAgo';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { AppText, Card } from './ui';

// Ingeklapt antwoord van de vorige keer, onder een terugkerende vraag.
export function YearAgo({ answers, today, partnerName }: { answers: YearAgoAnswer[]; today: string; partnerName: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const mine = answers.find((a) => a.mine);
  if (!mine) return null;
  const theirs = answers.find((a) => !a.mine);
  const title = yearAgoTitle(mine.day, today);

  return (
    <Card tone="alt">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        accessibilityHint={open ? 'Klap in' : 'Lees je antwoord van de vorige keer'}
        style={{ minHeight: 44, justifyContent: 'center', borderRadius: radius.md }}
      >
        <AppText variant="large" color={colors.primary}>
          {open ? '▾' : '▸'} {title}
        </AppText>
      </Pressable>
      {open && (
        <View style={{ gap: spacing.sm }}>
          <AppText selectable>{mine.body}</AppText>
          {theirs ? (
            <>
              <AppText variant="label" color={colors.secondary}>
                {partnerName} schreef toen
              </AppText>
              <AppText selectable>{theirs.body}</AppText>
            </>
          ) : null}
        </View>
      )}
    </Card>
  );
}
