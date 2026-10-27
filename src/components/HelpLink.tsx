import { router } from 'expo-router';
import { View } from 'react-native';
import { Button } from './ui';

// Kleine, neutrale verwijzing naar de hulppagina (src/app/hulp.tsx).
export function HelpLink() {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        kind="ghost"
        label="Als het niet goed gaat"
        onPress={() => router.push('/hulp')}
        accessibilityHint="Signalen en waar je terechtkunt voor hulp"
      />
    </View>
  );
}
