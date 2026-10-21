import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Card, Pill, Row, Screen } from '@/components/ui';
import { fetchImportantDates } from '@/lib/api';
import { amsterdamDay } from '@/lib/dates';
import { daysUntil, relativeLabel, sortDates } from '@/lib/together';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type Entry = { href: Href; title: string; description: string; icon: keyof typeof Ionicons.glyphMap };

const ENTRIES: Entry[] = [
  {
    href: '/oefeningen',
    title: 'Oefeningen & tips',
    description: 'Korte oefeningen voor betere gesprekken, meer waardering en minder ruzie.',
    icon: 'barbell-outline',
  },
  {
    href: '/ideeen',
    title: 'Date-ideeën',
    description: 'Inspiratie voor tijd samen, van gratis tot uitpakken, binnen en buiten.',
    icon: 'bulb-outline',
  },
  {
    href: '/plannen',
    title: 'Onze plannen',
    description: 'Jullie gedeelde lijst met dingen die je samen wilt doen.',
    icon: 'checkbox-outline',
  },
  {
    href: '/datums',
    title: 'Belangrijke datums',
    description: 'Jubileum, verjaardagen en andere dagen, met een herinnering vooraf.',
    icon: 'calendar-outline',
  },
];

export default function Samen() {
  const { colors } = useTheme();
  const [upcoming, setUpcoming] = useState<{ title: string; days: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const today = amsterdamDay();
      fetchImportantDates()
        .then((dates) => {
          const first = sortDates(dates, today).find((d) => d.next);
          setUpcoming(first?.next ? { title: first.title, days: daysUntil(first.next, today) } : null);
        })
        .catch(() => setUpcoming(null));
    }, []),
  );

  return (
    <Screen>
      <AppText variant="title">Samen</AppText>
      <AppText muted>Werk samen aan jullie relatie en plan tijd voor elkaar.</AppText>
      {upcoming && (
        <Pressable onPress={() => router.push('/datums')} accessibilityRole="button" accessibilityLabel={`Eerstvolgende datum: ${upcoming.title}, ${relativeLabel(upcoming.days)}`}>
          <Card tone="alt">
            <Row>
              <View style={{ flex: 1 }}>
                <AppText variant="label" color={colors.secondary}>
                  Eerstvolgende datum
                </AppText>
                <AppText variant="large">{upcoming.title}</AppText>
              </View>
              <Pill label={relativeLabel(upcoming.days)} />
            </Row>
          </Card>
        </Pressable>
      )}
      {ENTRIES.map((e) => (
        <Pressable
          key={e.title}
          onPress={() => router.push(e.href)}
          accessibilityRole="button"
          accessibilityLabel={`${e.title}. ${e.description}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.lg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name={e.icon} size={30} color={colors.primary} importantForAccessibility="no" />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="large">{e.title}</AppText>
            <AppText variant="small" muted>
              {e.description}
            </AppText>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
