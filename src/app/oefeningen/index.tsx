import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, ErrorText, Pill, Row, Screen } from '@/components/ui';
import { fetchCompletions, fetchExercises } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import {
  CATEGORY_LABEL,
  completionCounts,
  filterExercises,
  minutesLabel,
  type Completion,
  type Exercise,
  type ExerciseCategory,
} from '@/lib/exercises';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const CATEGORIES: (ExerciseCategory | null)[] = [null, 'communicatie', 'waardering', 'conflict', 'verbinding'];

export default function Oefeningen() {
  const { colors } = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchExercises(), fetchCompletions()])
        .then(([e, c]) => {
          setExercises(e);
          setCompletions(c);
          setError(null);
        })
        .catch((e) => setError(friendlyError(e)));
    }, []),
  );

  const counts = completionCounts(completions);

  return (
    <Screen>
      <AppText muted>
        Korte oefeningen om samen te doen. Ze zijn gebaseerd op algemeen bekende inzichten over relaties. Ze vervangen geen
        hulp van een professional als het echt moeilijk is.
      </AppText>
      <Row wrap>
        {CATEGORIES.map((c) => {
          const active = category === c;
          const label = c ? CATEGORY_LABEL[c] : 'Alles';
          return (
            <Pressable
              key={label}
              onPress={() => setCategory(c)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Categorie: ${label}`}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : 'transparent',
              }}
            >
              <AppText variant="label" color={active ? colors.onPrimary : colors.text}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </Row>
      <ErrorText message={error} />
      {filterExercises(exercises, category).map((e) => {
        const done = counts.get(e.id) ?? 0;
        return (
          <Pressable
            key={e.slug}
            onPress={() => router.push({ pathname: '/oefeningen/[slug]', params: { slug: e.slug } })}
            accessibilityRole="button"
            accessibilityLabel={`${e.title}. ${CATEGORY_LABEL[e.category]}, ${minutesLabel(e.minutes)}. ${done ? `${done} keer gedaan` : 'Nog niet gedaan'}`}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.xs,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText variant="label" color={colors.secondary}>
              {CATEGORY_LABEL[e.category]} · {minutesLabel(e.minutes)}
            </AppText>
            <AppText variant="large">{e.title}</AppText>
            <AppText variant="small" muted>
              {e.intro}
            </AppText>
            {done > 0 && (
              <View style={{ marginTop: spacing.xs }}>
                <Pill label={`${done}× samen gedaan`} tone="secondary" />
              </View>
            )}
          </Pressable>
        );
      })}
    </Screen>
  );
}
