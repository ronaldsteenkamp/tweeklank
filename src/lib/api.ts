import { supabase } from './supabase';
import type { Answer, ArchiveDay, Profile, TodayQuestion } from './types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

// ---- Profiel & koppel ----

export async function fetchProfiles(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*'));
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  unwrap(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function fetchCoupleMembers(): Promise<{ couple_id: string; user_id: string }[]> {
  return unwrap(await supabase.from('couple_members').select('couple_id, user_id'));
}

export async function createInvite(): Promise<{ code: string; expires_at: string }> {
  const rows = unwrap(await supabase.rpc('create_invite')) as { code: string; expires_at: string }[];
  return rows[0];
}

export async function fetchOpenInvite(): Promise<{ code: string; expires_at: string } | null> {
  const rows = unwrap(
    await supabase
      .from('invites')
      .select('code, expires_at')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1),
  ) as { code: string; expires_at: string }[];
  return rows[0] ?? null;
}

export async function redeemInvite(code: string): Promise<void> {
  unwrap(await supabase.rpc('redeem_invite', { p_code: code }));
}

export async function leaveCouple(): Promise<void> {
  unwrap(await supabase.rpc('leave_couple'));
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}

// ---- Dagelijkse vraag ----

export async function fetchToday(): Promise<TodayQuestion> {
  const rows = unwrap(await supabase.rpc('get_today_question')) as TodayQuestion[];
  return rows[0];
}

const ANSWER_FIELDS = 'id, user_id, day, body, created_at, updated_at, answer_reactions(id, answer_id, user_id, emoji, message, created_at)';

export async function fetchAnswers(day: string): Promise<Answer[]> {
  return unwrap(
    await supabase.from('daily_answers').select(ANSWER_FIELDS).eq('day', day).order('created_at'),
  ) as Answer[];
}

export async function saveAnswer(params: {
  coupleId: string;
  userId: string;
  day: string;
  body: string;
  existingId?: number;
}): Promise<void> {
  const body = params.body.trim();
  if (params.existingId) {
    unwrap(await supabase.from('daily_answers').update({ body }).eq('id', params.existingId));
  } else {
    unwrap(
      await supabase
        .from('daily_answers')
        .insert({ couple_id: params.coupleId, user_id: params.userId, day: params.day, body }),
    );
  }
}

export async function addReaction(params: {
  answerId: number;
  userId: string;
  emoji?: string;
  message?: string;
}): Promise<void> {
  unwrap(
    await supabase.from('answer_reactions').insert({
      answer_id: params.answerId,
      user_id: params.userId,
      emoji: params.emoji ?? null,
      message: params.message?.trim() || null,
    }),
  );
}

export async function removeReaction(id: number): Promise<void> {
  unwrap(await supabase.from('answer_reactions').delete().eq('id', id));
}

export async function fetchArchive(): Promise<ArchiveDay[]> {
  return unwrap(
    await supabase
      .from('couple_daily')
      .select(`day, daily_questions(text, depth), daily_answers(${ANSWER_FIELDS})`)
      .order('day', { ascending: false }),
  ) as unknown as ArchiveDay[];
}

export async function fetchArchiveDay(day: string): Promise<ArchiveDay | null> {
  const rows = unwrap(
    await supabase
      .from('couple_daily')
      .select('day, daily_questions(text, depth), daily_answers(id)')
      .eq('day', day)
      .limit(1),
  ) as unknown as ArchiveDay[];
  return rows[0] ?? null;
}
