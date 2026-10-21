import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

// Luistert naar nieuwe antwoorden en reacties. RLS bepaalt wat er binnenkomt:
// het antwoord van je partner ontvang je pas als je het ook mag zien.
export function useCoupleRealtime(coupleId: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!coupleId) return;
    const channel = supabase
      .channel(`koppel-${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_answers', filter: `couple_id=eq.${coupleId}` }, () =>
        cb.current(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answer_reactions' }, () => cb.current())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);
}
