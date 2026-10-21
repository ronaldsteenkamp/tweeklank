import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, ErrorText } from '@/components/ui';
import { fetchArchive } from '@/lib/api';
import { relativeDayNl } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import type { ArchiveDay } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function Archief() {
  const { colors } = useTheme();
  const { me, partner } = useSession();
  const [days, setDays] = useState<ArchiveDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDays(await fetchArchive());
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const partnerName = partner?.display_name || 'je partner';

  const status = (d: ArchiveDay) => {
    const mine = d.daily_answers.some((a) => a.user_id === me?.id);
    const theirs = d.daily_answers.some((a) => a.user_id !== me?.id);
    if (mine && theirs) return 'Jullie hebben allebei geantwoord';
    if (mine) return `Wacht op ${partnerName}`;
    return 'Jij hebt (nog) niet geantwoord';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right']}>
      <FlatList
        data={days ?? []}
        keyExtractor={(d) => d.day}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <AppText muted>Alle vragen die jullie samen kregen, met jullie antwoorden.</AppText>
            <ErrorText message={error} />
          </View>
        }
        ListEmptyComponent={days ? <AppText muted>Hier verschijnen jullie eerdere vragen.</AppText> : undefined}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/dag/[day]', params: { day: item.day } })}
            accessibilityRole="button"
            accessibilityLabel={`${relativeDayNl(item.day)}: ${item.daily_questions.text}. ${status(item)}`}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.xs,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText variant="label" muted>
              {relativeDayNl(item.day)}
            </AppText>
            <AppText variant="large">{item.daily_questions.text}</AppText>
            <AppText variant="small" color={colors.secondary}>
              {status(item)}
            </AppText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
