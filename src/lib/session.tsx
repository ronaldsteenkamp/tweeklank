import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCoupleMembers, fetchProfiles } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';

type SessionValue = {
  loading: boolean;
  session: Session | null;
  me: Profile | null;
  partner: Profile | null;
  coupleId: string | null;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setMe(null);
      setPartner(null);
      setCoupleId(null);
      setDataReady(true);
      return;
    }
    try {
      const [profiles, members] = await Promise.all([fetchProfiles(), fetchCoupleMembers()]);
      setMe(profiles.find((p) => p.id === userId) ?? null);
      setPartner(profiles.find((p) => p.id !== userId) ?? null);
      setCoupleId(members[0]?.couple_id ?? null);
    } finally {
      setDataReady(true);
    }
  }, [userId]);

  useEffect(() => {
    setDataReady(false);
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <SessionContext.Provider
      value={{ loading: !authReady || !dataReady, session, me, partner, coupleId, refresh }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession buiten SessionProvider');
  return ctx;
}
