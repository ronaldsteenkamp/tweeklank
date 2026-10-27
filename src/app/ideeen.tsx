import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Chip, ErrorText, Row, Screen } from '@/components/ui';
import { addPlan, fetchDateIdeas } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { minutesLabel } from '@/lib/exercises';
import { useSession } from '@/lib/session';
import { BUDGET_LABEL, BUDGETS, filterIdeas, SETTING_LABEL, type Budget, type DateIdea, type Setting } from '@/lib/together';
import { useTheme } from '@/theme/ThemeProvider';

export default function Ideeen() {
  const { colors } = useTheme();
  const { me, coupleId } = useSession();
  const [ideas, setIdeas] = useState<DateIdea[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDateIdeas().then(setIdeas).catch((e) => setError(friendlyError(e)));
  }, []);

  const add = async (idea: DateIdea) => {
    if (!me || !coupleId) return;
    try {
      await addPlan({ coupleId, userId: me.id, title: idea.title, dateIdeaId: idea.id });
      setAdded((s) => new Set(s).add(idea.id));
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const shown = filterIdeas(ideas, { budget, setting });

  return (
    <Screen>
      <AppText variant="label" muted>
        Budget
      </AppText>
      <Row wrap>
        <Chip label="Alles" active={budget === null} onPress={() => setBudget(null)} accessibilityLabel="Budget: alles" />
        {BUDGETS.map((b) => (
          <Chip key={b} label={b === 'gratis' ? 'Gratis' : b} active={budget === b} onPress={() => setBudget(b)} accessibilityLabel={`Budget: ${BUDGET_LABEL[b]}`} />
        ))}
      </Row>
      <AppText variant="label" muted>
        Waar
      </AppText>
      <Row wrap>
        <Chip label="Alles" active={setting === null} onPress={() => setSetting(null)} accessibilityLabel="Waar: alles" />
        <Chip label="Binnen" active={setting === 'binnen'} onPress={() => setSetting('binnen')} />
        <Chip label="Buiten" active={setting === 'buiten'} onPress={() => setSetting('buiten')} />
        <Chip label="Op afstand" active={setting === 'op afstand'} onPress={() => setSetting('op afstand')} />
      </Row>
      <ErrorText message={error} />
      <AppText variant="small" muted accessibilityLiveRegion="polite">
        {shown.length} {shown.length === 1 ? 'idee' : 'ideeën'}
      </AppText>
      {shown.map((idea) => (
        <Card key={idea.slug}>
          <AppText variant="label" color={colors.secondary}>
            {BUDGET_LABEL[idea.budget]} · {SETTING_LABEL[idea.setting]} · {minutesLabel(idea.minutes)}
          </AppText>
          <AppText variant="large">{idea.title}</AppText>
          <AppText muted>{idea.description}</AppText>
          <View style={{ alignSelf: 'flex-start' }}>
            {added.has(idea.id) ? (
              <Button kind="ghost" label="Op jullie lijst ✓ Bekijk" onPress={() => router.push('/plannen')} />
            ) : (
              <Button kind="secondary" label="Zet op onze lijst" onPress={() => add(idea)} accessibilityHint={`Voegt ${idea.title} toe aan jullie plannen`} />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
