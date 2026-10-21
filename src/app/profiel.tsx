import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Field, Screen } from '@/components/ui';
import { updateProfile } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

export default function Profiel() {
  const { session, me, refresh } = useSession();
  const [name, setName] = useState(me?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(session.user.id, { display_name: name.trim() });
      await refresh();
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <AppText variant="title">Hoe mag je partner je noemen?</AppText>
        <AppText muted>Alleen jij en je partner zien deze naam.</AppText>
        <Field
          label="Je naam of koosnaam"
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && save()}
          error={error}
        />
        <Button label="Verder" onPress={save} disabled={!name.trim()} busy={busy} />
      </View>
    </Screen>
  );
}
