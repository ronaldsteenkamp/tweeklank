import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, ErrorText, Pill, Row, Screen } from '@/components/ui';
import { fetchCardMarks, fetchThemes, type ThemeSummary } from '@/lib/api';
import { progress, type CardMark } from '@/lib/cards';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function Kaarten() {
  const { colors } = useTheme();
  const [themes, setThemes] = useState<ThemeSummary[] | null>(null);
  const [marks, setMarks] = useState<CardMark[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchThemes(), fetchCardMarks()])
        .then(([t, m]) => {
          setThemes(t);
          setMarks(m);
          setError(null);
        })
        .catch((e) => setError(friendlyError(e)));
    }, []),
  );

  return (
    <Screen>
      <AppText variant="title">Gesprekskaarten</AppText>
      <AppText muted>Kies een thema, pak er een rustig moment bij en neem om de beurt een kaart.</AppText>
      <ErrorText message={error} />
      {(themes ?? []).map((t) => {
        const p = progress(
          t.theme_questions.map((q) => q.id),
          marks,
        );
        return (
          <Pressable
            key={t.slug}
            onPress={() => router.push({ pathname: '/kaarten/[thema]', params: { thema: t.slug } })}
            accessibilityRole="button"
            accessibilityLabel={`${t.name}. ${t.description}. ${p.discussed} van ${p.total} besproken`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: spacing.md,
              alignItems: 'center',
              backgroundColor: t.is_explicit ? colors.surfaceAlt : colors.surface,
              borderColor: t.is_explicit ? colors.primary : colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.lg,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={t.icon as keyof typeof Ionicons.glyphMap}
              size={30}
              color={colors.primary}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="large">{t.name}</AppText>
              <AppText variant="small" muted>
                {t.description}
              </AppText>
              <Row>
                <Pill
                  label={p.discussed === p.total ? 'Alles besproken' : `${p.discussed}/${p.total} besproken`}
                  tone={p.discussed === p.total ? 'secondary' : 'accent'}
                />
              </Row>
            </View>
          </Pressable>
        );
      })}
      {themes && !themes.some((t) => t.is_explicit) && (
        <AppText variant="small" muted>
          Er is ook een 18+-set met openhartige vragen. Die verschijnt hier als jullie hem allebei aanzetten onder Ik.
        </AppText>
      )}
    </Screen>
  );
}
