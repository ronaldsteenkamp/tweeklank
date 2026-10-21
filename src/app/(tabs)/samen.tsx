import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText, Screen } from '@/components/ui';
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
];

export default function Samen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <AppText variant="title">Samen</AppText>
      <AppText muted>Werk samen aan jullie relatie en plan tijd voor elkaar.</AppText>
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
