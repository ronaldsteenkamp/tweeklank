import { Alert } from 'react-native';
import { unregisterPush } from './push';
import { supabase } from './supabase';

export async function signOut(): Promise<void> {
  await unregisterPush();
  await supabase.auth.signOut();
}

/**
 * Uitloggen met bevestiging. Een account zonder e-mail (anoniem) bestaat alleen op deze telefoon:
 * na uitloggen kom je er niet meer in, dus dat zeggen we er duidelijk bij.
 */
export function confirmSignOut(isAnonymous: boolean, onDone: () => void): void {
  Alert.alert(
    'Uitloggen?',
    isAnonymous
      ? 'Je account staat alleen op deze telefoon en heeft geen e-mailadres. Na uitloggen kun je er niet meer in, en moet je je partner opnieuw koppelen.'
      : 'Je kunt later weer inloggen met je e-mailadres.',
    [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: () => signOut().then(onDone) },
    ],
  );
}
