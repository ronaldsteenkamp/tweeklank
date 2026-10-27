import { Linking, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { CONTACTS, EMERGENCY, SIGNALS, type HelpAction } from '@/lib/help';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// Statisch scherm: geen meldingen, geen opslag van bezoeken, geen analyse.
export default function Hulp() {
  const { colors } = useTheme();
  return (
    <Screen>
      <AppText variant="title">Als het niet goed gaat</AppText>
      <AppText>
        Onenigheid hoort bij elke relatie. Soms gaat het om meer dan een gewone ruzie. Dan hoef je het niet alleen op te
        lossen.
      </AppText>

      <Card tone="alt">
        <AppText variant="large">Direct in gevaar?</AppText>
        <AppText>Bel dan meteen 112.</AppText>
        <ActionButton action={EMERGENCY} primary />
      </Card>

      <Card>
        <AppText variant="large">Wanneer het om meer gaat</AppText>
        {SIGNALS.map((s) => (
          <View key={s} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText color={colors.primary} importantForAccessibility="no" accessibilityElementsHidden>
              •
            </AppText>
            <AppText style={{ flex: 1 }}>{s}</AppText>
          </View>
        ))}
        <AppText muted>
          Herken je dit, of maak je je zorgen om iemand anders? Praat erover met iemand die je vertrouwt, of neem contact op
          met een van de organisaties hieronder.
        </AppText>
      </Card>

      {CONTACTS.map((c) => (
        <Card key={c.name}>
          <AppText variant="large">{c.name}</AppText>
          <AppText>{c.body}</AppText>
          {c.actions.map((a) => (
            <ActionButton key={a.url} action={a} />
          ))}
        </Card>
      ))}

      <AppText variant="small" muted>
        Deze pagina slaat niets op en stuurt niets door. Je partner ziet niet dat je hier bent geweest.
      </AppText>
    </Screen>
  );
}

function ActionButton({ action, primary }: { action: HelpAction; primary?: boolean }) {
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Button
        kind={primary ? 'primary' : 'secondary'}
        label={action.label}
        accessibilityLabel={action.a11y}
        accessibilityRole={action.url.startsWith('tel:') ? 'button' : 'link'}
        onPress={() => Linking.openURL(action.url).catch(() => {})}
      />
    </View>
  );
}
