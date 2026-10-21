import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DateFields, type DateParts } from '@/components/DateFields';
import { AppText, Button, Card, ErrorText, Field, Row, Screen } from '@/components/ui';
import { addPlan, deletePlan, fetchPlans, updatePlan } from '@/lib/api';
import { amsterdamDay } from '@/lib/dates';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { daysUntil, formatDateNl, parseDateParts, relativeLabel, sortPlans, type Plan } from '@/lib/together';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const EMPTY: DateParts = { day: '', month: '', year: '' };

export default function Plannen() {
  const { colors } = useTheme();
  const { me, partner, coupleId } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<DateParts>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = amsterdamDay();

  const load = useCallback(async () => {
    try {
      setPlans(await fetchPlans());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasDate = date.day || date.month || date.year;
  const parsed = hasDate ? parseDateParts(date.day, date.month, date.year) : null;
  const dateError = hasDate && !parsed && date.year.length === 4 ? 'Deze datum bestaat niet.' : null;

  const add = async () => {
    if (!me || !coupleId || !title.trim() || (hasDate && !parsed)) return;
    setBusy(true);
    setError(null);
    try {
      await addPlan({ coupleId, userId: me.id, title, plannedFor: parsed });
      setTitle('');
      setDate(EMPTY);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: Plan) => {
    setPlans((list) => list.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)));
    try {
      await updatePlan(p.id, { done: !p.done });
    } catch (e) {
      setError(friendlyError(e));
      load();
    }
  };

  const confirmDelete = (p: Plan) =>
    Alert.alert('Plan verwijderen?', p.title, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => deletePlan(p.id).then(load).catch((e) => setError(friendlyError(e))) },
    ]);

  const who = (id: string) => (id === me?.id ? 'jij' : partner?.display_name || 'je partner');

  return (
    <Screen>
      <Card>
        <AppText variant="large">Nieuw plan</AppText>
        <Field label="Wat gaan jullie doen?" value={title} onChangeText={setTitle} maxLength={120} placeholder="Bijvoorbeeld: samen naar de markt" />
        <DateFields label="Wanneer? (optioneel)" value={date} onChange={setDate} error={dateError} />
        <Button label="Toevoegen" onPress={add} disabled={!title.trim() || (!!hasDate && !parsed)} busy={busy} />
        <Button kind="ghost" label="Inspiratie nodig? Bekijk date-ideeën" onPress={() => router.push('/ideeen')} />
      </Card>
      <ErrorText message={error} />
      {plans.length === 0 && <AppText muted>Nog geen plannen. Voeg er een toe of kies een date-idee.</AppText>}
      {sortPlans(plans).map((p) => {
        const days = p.planned_for ? daysUntil(p.planned_for, today) : null;
        return (
          <Card key={p.id}>
            <Row gap={spacing.md}>
              <Pressable
                onPress={() => toggle(p)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: p.done }}
                accessibilityLabel={`${p.title}: ${p.done ? 'gedaan' : 'nog te doen'}`}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.sm,
                  borderWidth: 2,
                  borderColor: p.done ? colors.secondary : colors.border,
                  backgroundColor: p.done ? colors.secondary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.done ? <AppText color={colors.onSecondary}>✓</AppText> : null}
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText variant="large" style={p.done ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}>
                  {p.title}
                </AppText>
                <AppText variant="small" muted>
                  {p.planned_for
                    ? `${formatDateNl(p.planned_for)}${!p.done && days !== null && days >= 0 ? ` · ${relativeLabel(days).toLowerCase()}` : ''}`
                    : 'Nog geen datum'}{' '}
                  · toegevoegd door {who(p.created_by)}
                </AppText>
              </View>
              <Button kind="ghost" label="Wis" onPress={() => confirmDelete(p)} accessibilityHint={`Verwijder ${p.title}`} />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
