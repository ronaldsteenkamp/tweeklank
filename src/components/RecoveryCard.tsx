import { router } from 'expo-router';
import { View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { AppText, Button, Card } from './ui';

// Rustige kaart: bewaar een manier om terug te komen in een account zonder e-mail.
export function RecoveryCard({ onLater }: { onLater?: () => void }) {
  return (
    <Card>
      <AppText variant="large">Bewaar een manier om terug te komen</AppText>
      <AppText muted>
        Je account staat alleen op deze telefoon. Raakt hij kwijt, dan kom je zo toch terug, met je koppeling en al jullie
        antwoorden.
      </AppText>
      <View style={{ gap: spacing.sm }}>
        <Button kind="secondary" label="E-mail koppelen" onPress={() => router.push('/email-koppelen')} />
        <Button kind="secondary" label="Herstelcode maken" onPress={() => router.push('/herstelcode')} />
        {onLater && <Button kind="ghost" label="Later" onPress={onLater} accessibilityHint="Je vindt dit ook onder Ik" />}
      </View>
    </Card>
  );
}
