import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchNudgeStatus, sendNudge } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { nudgeHint, type NudgeStatus } from '@/lib/nudge';
import { spacing } from '@/theme/tokens';
import { AppText, Button, ErrorText } from './ui';

// "Ik denk aan je": één keer per dag, de melding bevat alleen je naam.
export function NudgeButton({ partnerName }: { partnerName: string }) {
  const [status, setStatus] = useState<NudgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchNudgeStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useFocusEffect(load);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendNudge();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      load();
    }
  };

  const available = !!status?.available && !status.sent_today;
  return (
    <View style={{ gap: spacing.xs }}>
      <Button
        kind="secondary"
        label="Ik denk aan je"
        onPress={send}
        disabled={!available}
        busy={busy}
        accessibilityHint={`Stuur ${partnerName} een seintje zonder inhoud`}
      />
      <AppText variant="small" muted accessibilityLiveRegion="polite">
        {nudgeHint(status, partnerName)}
      </AppText>
      <ErrorText message={error} />
    </View>
  );
}
