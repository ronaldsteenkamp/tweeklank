import { useCallback, useEffect, useState } from 'react';
import { fetchCardSession } from './api';
import type { CardSession } from './cardSession';
import { supabase } from './supabase';

// De lopende speelsessie van jullie koppel, live via Realtime (RLS: alleen je eigen koppel).
export function useCardSession(coupleId: string | null) {
  const [session, setSession] = useState<CardSession | null>(null);

  const reload = useCallback(() => {
    fetchCardSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!coupleId) return;
    reload();
    const channel = supabase
      .channel(`samen-spelen-${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_sessions', filter: `couple_id=eq.${coupleId}` }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, reload]);

  // Na 2 uur verloopt de sessie vanzelf, ook als er niets meer verandert
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expires_at).getTime() - Date.now();
    const t = setTimeout(reload, Math.max(ms, 0) + 1000);
    return () => clearTimeout(t);
  }, [session, reload]);

  return { session, reload };
}
