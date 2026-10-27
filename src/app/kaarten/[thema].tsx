import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, Switch, useWindowDimensions, View } from 'react-native';
import { HelpLink } from '@/components/HelpLink';
import { TogetherCard } from '@/components/TogetherCard';
import { AppText, Button, Chip, DEPTH_LABEL, ErrorText, Loading, Row, Screen } from '@/components/ui';
import { fetchCardMarks, fetchTheme, setCardMark, showCardTogether, type ThemeDetail } from '@/lib/api';
import {
  applyOrder,
  clampIndex,
  DEFAULT_FILTER,
  filterCards,
  isMarked,
  shuffleIds,
  type CardFilter,
  type CardMark,
  type CardQuestion,
  type MarkKind,
} from '@/lib/cards';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { useCardSession } from '@/lib/useCardSession';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const DEPTHS: CardFilter['depth'][] = [0, 1, 2, 3];

export default function ThemaKaarten() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { thema } = useLocalSearchParams<{ thema: string }>();
  const { me, partner, coupleId } = useSession();
  const { session: playing } = useCardSession(coupleId);
  const [theme, setTheme] = useState<ThemeDetail | null | undefined>(undefined);
  const [marks, setMarks] = useState<CardMark[]>([]);
  const [filter, setFilter] = useState<CardFilter>(DEFAULT_FILTER);
  const [index, setIndex] = useState(0);
  // Geschudde volgorde: alleen lokaal en zolang dit scherm open is
  const [order, setOrder] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<CardQuestion>>(null);

  useEffect(() => {
    Promise.all([fetchTheme(String(thema)), fetchCardMarks()])
      .then(([t, m]) => {
        setTheme(t);
        setMarks(m);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [thema]);

  const cards = useMemo(
    () => (theme ? applyOrder(filterCards(theme.theme_questions, marks, filter), order) : []),
    [theme, marks, filter, order],
  );
  const current = clampIndex(index, cards.length);

  const goTo = useCallback(
    (i: number) => {
      const next = clampIndex(i, cards.length);
      setIndex(next);
      if (cards.length) listRef.current?.scrollToIndex({ index: next, animated: true });
    },
    [cards.length],
  );

  const changeFilter = (patch: Partial<CardFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const shuffle = () => {
    if (!theme) return;
    setOrder(shuffleIds(theme.theme_questions.map((q) => q.id)));
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    AccessibilityInfo.announceForAccessibility('Kaarten geschud');
  };

  const playTogether = async () => {
    const first = cards[current] ?? cards[0];
    if (!first) return;
    try {
      await showCardTogether(first.id);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const toggle = async (question: CardQuestion, kind: MarkKind) => {
    if (!me || !coupleId) return;
    const on = !isMarked(marks, question.id, kind);
    const before = marks;
    // direct tonen, bij een fout terugdraaien
    setMarks(on ? [...marks, { question_id: question.id, kind }] : marks.filter((m) => !(m.question_id === question.id && m.kind === kind)));
    try {
      await setCardMark({ coupleId, userId: me.id, questionId: question.id, kind, on });
    } catch (e) {
      setMarks(before);
      setError(friendlyError(e));
    }
  };

  if (theme === undefined && !error) return <Loading />;
  if (!theme) return <Screen><ErrorText message={error ?? 'Dit thema bestaat niet (of is niet zichtbaar voor jullie).'} /></Screen>;

  const cardWidth = width - spacing.lg * 2;
  const together = !!playing && playing.theme_id === theme.id;
  const partnerName = partner?.display_name || 'Je partner';

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: theme.name }} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        <Row wrap>
          {DEPTHS.map((d) => {
            const active = filter.depth === d;
            const label = d === 0 ? 'Alles' : DEPTH_LABEL[d];
            return <Chip key={d} label={label} active={active} onPress={() => changeFilter({ depth: d })} accessibilityLabel={`Diepgang: ${label}`} />;
          })}
        </Row>
        {!together && (
          <Row wrap>
            <Button kind="secondary" label="Schud" onPress={shuffle} accessibilityHint="Zet de kaarten in een willekeurige volgorde" />
            <Button
              kind="secondary"
              label="Speel samen"
              onPress={playTogether}
              accessibilityHint={`${partnerName} volgt live dezelfde kaart, ook op afstand`}
            />
          </Row>
        )}
        <FilterSwitch label="Verberg besproken" value={filter.hideDiscussed} onChange={(v) => changeFilter({ hideDiscussed: v })} />
        <FilterSwitch label="Alleen favorieten" value={filter.onlyFavorites} onChange={(v) => changeFilter({ onlyFavorites: v })} />
        <ErrorText message={error} />
      </View>

      {together ? (
        <TogetherCard
          question={theme.theme_questions.find((q) => q.id === playing?.question_id)}
          cards={cards}
          partnerName={partnerName}
        />
      ) : cards.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <AppText muted>
            {filter.onlyFavorites
              ? 'Nog geen favorieten bij deze filters. Tik op het hartje bij een kaart om hem te bewaren.'
              : 'Alle kaarten met deze filters zijn besproken. Mooi!'}
          </AppText>
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={cards}
            keyExtractor={(c) => String(c.id)}
            horizontal
            pagingEnabled
            snapToInterval={width}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => {
              const discussed = isMarked(marks, item.id, 'besproken');
              const favorite = isMarked(marks, item.id, 'favoriet');
              return (
                <View style={{ width, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                  <View
                    style={{
                      width: cardWidth,
                      minHeight: 280,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.lg,
                      padding: spacing.xl,
                      gap: spacing.lg,
                      justifyContent: 'space-between',
                    }}
                  >
                    <AppText variant="label" color={colors.secondary}>
                      {DEPTH_LABEL[item.depth]}
                    </AppText>
                    <AppText variant="title" accessibilityRole="text">
                      {item.text}
                    </AppText>
                    <Row wrap>
                      <MarkButton label="Besproken" icon="✓" active={discussed} onPress={() => toggle(item, 'besproken')} />
                      <MarkButton label="Favoriet" icon="♥" active={favorite} onPress={() => toggle(item, 'favoriet')} />
                    </Row>
                  </View>
                </View>
              );
            }}
          />
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
            <AppText variant="small" muted style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
              Kaart {current + 1} van {cards.length}
            </AppText>
            <Row>
              <View style={{ flex: 1 }}>
                <Button kind="secondary" label="Vorige" onPress={() => goTo(current - 1)} disabled={current === 0} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Volgende" onPress={() => goTo(current + 1)} disabled={current >= cards.length - 1} />
              </View>
            </Row>
          </View>
        </>
      )}
      {theme.slug === 'th-onenigheid' && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <HelpLink />
        </View>
      )}
    </Screen>
  );
}

function FilterSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Row>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </Row>
  );
}

function MarkButton({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: active ? colors.secondary : colors.border,
        backgroundColor: active ? colors.secondary : 'transparent',
      }}
    >
      <AppText variant="label" color={active ? colors.onSecondary : colors.text}>
        {icon} {label}
      </AppText>
    </Pressable>
  );
}
