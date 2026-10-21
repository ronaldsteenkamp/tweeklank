import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui';
import { extractInviteCode } from '@/lib/invite';
import { setPendingInvite } from '@/lib/pendingInvite';

// Deep link: tweeklank://koppel/ABC234 → code onthouden en naar het koppelscherm.
export default function KoppelLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const parsed = extractInviteCode(String(code ?? ''));
    (parsed ? setPendingInvite(parsed) : Promise.resolve()).finally(() => setReady(true));
  }, [code]);

  if (!ready) return <Loading />;
  return <Redirect href="/" />;
}
