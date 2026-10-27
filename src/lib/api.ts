import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { YesterdayQuestion } from './catchup';
import type { CardMark, CardQuestion, MarkKind } from './cards';
import type { Completion, Exercise } from './exercises';
import type { DateIdea, ImportantDate, Plan } from './together';
import type { QuizKind, QuizResultRow } from './quiz';
import type { Checkin, ScaleKey } from './checkin';
import type { NudgeStatus } from './nudge';
import type { WeekStatus } from './rhythm';
import type { SeriesOffer } from './series';
import type { YearAgoAnswer } from './yearAgo';
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

// ---- Overzetten naar een nieuwe telefoon ----

export async function createTransferCode(): Promise<{ code: string; expires_at: string }> {
  const rows = unwrap(await supabase.rpc('create_transfer_code')) as { code: string; expires_at: string }[];
  return rows[0];
}

/** Op de nieuwe telefoon: wisselt de code in en logt in op hetzelfde account. */
export async function redeemTransferCode(code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ token_hash?: string }>('transfer-account', {
    method: 'POST',
    body: { code },
  });
  if (error) {
    if (error instanceof FunctionsHttpError && error.context?.status === 400) throw new Error('overzetcode_onbekend');
    throw error;
  }
  if (!data?.token_hash) throw new Error('overzetcode_onbekend');
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (verifyError) throw verifyError;
}

/** Herstelcode van 16 tekens om te bewaren; een eerdere vervalt. */
export async function createRecoveryCode(): Promise<string> {
  return unwrap(await supabase.rpc('create_recovery_code')) as string;
}

export async function hasRecoveryCode(): Promise<boolean> {
  return !!unwrap(await supabase.rpc('has_recovery_code'));
}

// ---- Dagelijkse vraag ----

export async function fetchToday(): Promise<TodayQuestion> {
  const rows = unwrap(await supabase.rpc('get_today_question')) as TodayQuestion[];
  return rows[0];
}

/** De vraag van gisteren (alleen als die gisteren al aan jullie was toegewezen), anders null. */
export async function fetchYesterday(): Promise<YesterdayQuestion | null> {
  const rows = unwrap(await supabase.rpc('get_yesterday_question')) as YesterdayQuestion[];
  return rows[0] ?? null;
}

/** De antwoorden van de vorige keer bij een terugkerende vraag (alleen na je eigen nieuwe antwoord). */
export async function fetchYearAgo(day: string): Promise<YearAgoAnswer[]> {
  return unwrap(await supabase.rpc('get_year_ago', { p_day: day })) as YearAgoAnswer[];
}

// ---- Themaweken ----

export async function fetchSeriesOffer(): Promise<SeriesOffer[]> {
  return unwrap(await supabase.rpc('get_series_offer')) as SeriesOffer[];
}

/** Geeft 'gestart' als jullie allebei deze serie kozen, anders 'wacht'. */
export async function chooseSeries(seriesId: number): Promise<'gestart' | 'wacht'> {
  return unwrap(await supabase.rpc('choose_series', { p_series: seriesId })) as 'gestart' | 'wacht';
}

export async function dismissSeriesOffer(): Promise<void> {
  unwrap(await supabase.rpc('dismiss_series_offer', { p_snooze: true }));
}

// ---- Ik denk aan je ----

export async function fetchNudgeStatus(): Promise<NudgeStatus | null> {
  const rows = unwrap(await supabase.rpc('nudge_status')) as NudgeStatus[];
  return rows[0] ?? null;
}

export async function sendNudge(): Promise<void> {
  unwrap(await supabase.rpc('send_nudge'));
}

// ---- Solo-modus ----

export async function fetchSoloCardDue(): Promise<boolean> {
  return !!unwrap(await supabase.rpc('solo_card_due'));
}

export async function dismissSoloCard(): Promise<void> {
  unwrap(await supabase.rpc('dismiss_solo_card'));
}

// ---- Maandelijkse check-in ----

/** Eerste dag van de maand als de check-in nu open is (dag 1 t/m 7), anders null. */
export async function fetchCheckinOpenMonth(): Promise<string | null> {
  return (unwrap(await supabase.rpc('checkin_open_month')) as string | null) ?? null;
}

/** Check-ins die je mag zien (RLS: die van je partner pas na je eigen check-in van die maand). */
export async function fetchCheckins(): Promise<Checkin[]> {
  return unwrap(
    await supabase.from('checkins').select('id, user_id, month, connection, appreciated, conflict, time_together, wish').order('month', { ascending: false }).limit(12),
  ) as Checkin[];
}

export async function saveCheckin(params: {
  coupleId: string;
  userId: string;
  month: string;
  values: Record<ScaleKey, number>;
  wish: string;
}): Promise<void> {
  unwrap(
    await supabase.from('checkins').insert({
      couple_id: params.coupleId,
      user_id: params.userId,
      month: params.month,
      ...params.values,
      wish: params.wish.trim() || null,
    }),
  );
}

// ---- Weekritme ----

export async function fetchWeek(): Promise<WeekStatus | null> {
  const rows = unwrap(await supabase.rpc('my_week')) as WeekStatus[];
  return rows[0] ?? null;
}

export async function setWeekGoal(goal: number): Promise<void> {
  unwrap(await supabase.rpc('set_week_goal', { p_goal: goal }));
}

/** weeks = null: pauze tot een van jullie hem uitzet */
export async function startPause(weeks: 1 | 2 | 4 | null): Promise<void> {
  unwrap(await supabase.rpc('start_pause', { p_weeks: weeks }));
}

export async function stopPause(): Promise<void> {
  unwrap(await supabase.rpc('stop_pause'));
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

// ---- Quizzen ----

export type QuizOverview = {
  quiz_id: number;
  slug: string;
  title: string;
  description: string;
  question_count: number;
  my_progress: number;
  partner_done: boolean;
  my_score: number | null;
  partner_score: number | null;
};

export type QuizQuestion = { id: number; position: number; prompt: string; options: string[] };
export type QuizDetail = { id: number; slug: string; title: string; quiz_questions: QuizQuestion[] };

export async function fetchQuizOverview(): Promise<QuizOverview[]> {
  return unwrap(await supabase.rpc('quiz_overview')) as QuizOverview[];
}

export async function fetchQuiz(slug: string): Promise<QuizDetail> {
  const quiz = unwrap(
    await supabase
      .from('quizzes')
      .select('id, slug, title, quiz_questions(id, position, prompt, options)')
      .eq('slug', slug)
      .single(),
  ) as QuizDetail;
  quiz.quiz_questions.sort((a, b) => a.position - b.position);
  return quiz;
}

export async function fetchMyQuizResponses(
  quizId: number,
  userId: string,
): Promise<{ question_id: number; kind: QuizKind; option_index: number }[]> {
  return unwrap(
    await supabase
      .from('quiz_responses')
      .select('question_id, kind, option_index')
      .eq('quiz_id', quizId)
      .eq('user_id', userId),
  ) as { question_id: number; kind: QuizKind; option_index: number }[];
}

export async function saveQuizResponse(params: {
  coupleId: string;
  userId: string;
  quizId: number;
  questionId: number;
  kind: QuizKind;
  optionIndex: number;
}): Promise<void> {
  unwrap(
    await supabase.from('quiz_responses').upsert(
      {
        couple_id: params.coupleId,
        user_id: params.userId,
        quiz_id: params.quizId,
        question_id: params.questionId,
        kind: params.kind,
        option_index: params.optionIndex,
      },
      { onConflict: 'couple_id,question_id,user_id,kind' },
    ),
  );
}

export async function fetchQuizResult(quizId: number): Promise<QuizResultRow[]> {
  return unwrap(await supabase.rpc('quiz_result', { p_quiz: quizId })) as QuizResultRow[];
}

// ---- Gesprekskaarten ----

export type ThemeSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  is_explicit: boolean;
  position: number;
  theme_questions: { id: number }[];
};

export type ThemeDetail = Omit<ThemeSummary, 'theme_questions'> & { theme_questions: CardQuestion[] };

export async function fetchThemes(): Promise<ThemeSummary[]> {
  return unwrap(
    await supabase
      .from('themes')
      .select('id, slug, name, description, icon, is_explicit, position, theme_questions(id)')
      .order('position'),
  ) as ThemeSummary[];
}

export async function fetchTheme(slug: string): Promise<ThemeDetail | null> {
  const rows = unwrap(
    await supabase
      .from('themes')
      .select('id, slug, name, description, icon, is_explicit, position, theme_questions(id, position, text, depth)')
      .eq('slug', slug)
      .limit(1),
  ) as ThemeDetail[];
  return rows[0] ?? null;
}

export async function fetchCardMarks(): Promise<CardMark[]> {
  return unwrap(await supabase.from('card_marks').select('question_id, kind')) as CardMark[];
}

export async function setCardMark(params: {
  coupleId: string;
  userId: string;
  questionId: number;
  kind: MarkKind;
  on: boolean;
}): Promise<void> {
  if (params.on) {
    unwrap(
      await supabase.from('card_marks').upsert(
        { couple_id: params.coupleId, question_id: params.questionId, kind: params.kind, created_by: params.userId },
        { onConflict: 'couple_id,question_id,kind', ignoreDuplicates: true },
      ),
    );
  } else {
    unwrap(
      await supabase
        .from('card_marks')
        .delete()
        .eq('couple_id', params.coupleId)
        .eq('question_id', params.questionId)
        .eq('kind', params.kind),
    );
  }
}

// ---- Oefeningen ----

export async function fetchExercises(): Promise<Exercise[]> {
  return unwrap(await supabase.from('exercises').select('*').order('position')) as Exercise[];
}

export async function fetchExercise(slug: string): Promise<Exercise | null> {
  const rows = unwrap(await supabase.from('exercises').select('*').eq('slug', slug).limit(1)) as Exercise[];
  return rows[0] ?? null;
}

export async function fetchCompletions(exerciseId?: number): Promise<Completion[]> {
  let q = supabase
    .from('exercise_completions')
    .select('id, exercise_id, user_id, completed_at, note')
    .order('completed_at', { ascending: false });
  if (exerciseId) q = q.eq('exercise_id', exerciseId);
  return unwrap(await q) as Completion[];
}

export async function addCompletion(params: { coupleId: string; userId: string; exerciseId: number; note?: string }): Promise<void> {
  unwrap(
    await supabase.from('exercise_completions').insert({
      couple_id: params.coupleId,
      user_id: params.userId,
      exercise_id: params.exerciseId,
      note: params.note?.trim() || null,
    }),
  );
}

export async function removeCompletion(id: number): Promise<void> {
  unwrap(await supabase.from('exercise_completions').delete().eq('id', id));
}

// ---- Samen plannen ----

export async function fetchDateIdeas(): Promise<DateIdea[]> {
  return unwrap(await supabase.from('date_ideas').select('*').order('position')) as DateIdea[];
}

const PLAN_FIELDS = 'id, title, notes, planned_for, done, created_at, created_by';

export async function fetchPlans(): Promise<Plan[]> {
  return unwrap(await supabase.from('plans').select(PLAN_FIELDS)) as Plan[];
}

export async function addPlan(params: {
  coupleId: string;
  userId: string;
  title: string;
  plannedFor?: string | null;
  dateIdeaId?: number;
}): Promise<void> {
  unwrap(
    await supabase.from('plans').insert({
      couple_id: params.coupleId,
      created_by: params.userId,
      title: params.title.trim(),
      planned_for: params.plannedFor ?? null,
      date_idea_id: params.dateIdeaId ?? null,
    }),
  );
}

export async function updatePlan(id: number, patch: Partial<Pick<Plan, 'title' | 'notes' | 'planned_for' | 'done'>>): Promise<void> {
  unwrap(await supabase.from('plans').update(patch).eq('id', id));
}

export async function deletePlan(id: number): Promise<void> {
  unwrap(await supabase.from('plans').delete().eq('id', id));
}

const DATE_FIELDS = 'id, title, kind, date, yearly, remind_days_before, created_by';

export async function fetchImportantDates(): Promise<ImportantDate[]> {
  return unwrap(await supabase.from('important_dates').select(DATE_FIELDS)) as ImportantDate[];
}

export type ImportantDateInput = Pick<ImportantDate, 'title' | 'kind' | 'date' | 'yearly' | 'remind_days_before'>;

export async function saveImportantDate(params: {
  coupleId: string;
  userId: string;
  id?: number;
  value: ImportantDateInput;
}): Promise<void> {
  const value = { ...params.value, title: params.value.title.trim() };
  if (params.id) {
    unwrap(await supabase.from('important_dates').update(value).eq('id', params.id));
  } else {
    unwrap(await supabase.from('important_dates').insert({ ...value, couple_id: params.coupleId, created_by: params.userId }));
  }
}

export async function deleteImportantDate(id: number): Promise<void> {
  unwrap(await supabase.from('important_dates').delete().eq('id', id));
}
