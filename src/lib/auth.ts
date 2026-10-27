import { Alert } from 'react-native';
import { unregisterPush } from './push';
import { supabase } from './supabase';

export async function signOut(): Promise<void> {
  await unregisterPush();
  // Alleen deze telefoon: na overzetten blijft de nieuwe telefoon gewoon ingelogd.
  await supabase.auth.signOut({ scope: 'local' });
}

/**
 * Uitloggen met bevestiging. Een account zonder e-mail (anoniem) bestaat alleen op deze telefoon:
 * na uitloggen kom je er niet meer in, dus dat zeggen we er duidelijk bij.
 */
export function confirmSignOut(phoneOnly: boolean, onDone: () => void): void {
  Alert.alert(
    'Uitloggen?',
    phoneOnly
      ? 'Je account staat alleen op deze telefoon en heeft geen e-mailadres. Na uitloggen kun je er niet meer in, en moet je je partner opnieuw koppelen. Heb je het al overgezet naar een nieuwe telefoon? Dan kun je hier gerust uitloggen.'
      : 'Je kunt later weer inloggen met je e-mailadres.',
    [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: () => signOut().then(onDone) },
    ],
  );
}
