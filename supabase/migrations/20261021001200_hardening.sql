-- Verbeteringen na de Supabase-adviseurs (security + performance).
--
-- 1. auth.uid() en de koppel-hulpfuncties in RLS-policies via (select …), zodat Postgres ze
--    één keer per query uitrekent in plaats van per rij (lint: auth_rls_initplan).
-- 2. Hulpfuncties die een willekeurig id accepteren, geven alleen nog antwoord over het
--    eigen koppel / jezelf en je partner.
-- 3. Indexen op foreign keys (lint: unindexed_foreign_keys).
-- Alleen ALTER POLICY / CREATE OR REPLACE / CREATE INDEX: niets wordt verwijderd.

-------------------------------------------------------------------------------
-- 1. Policies
-------------------------------------------------------------------------------

alter policy "profiel lezen: zelf of partner" on public.profiles
  using (id = (select auth.uid()) or id = (select public.my_partner_id()));
alter policy "profiel wijzigen: alleen zelf" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "koppel lezen" on public.couples
  using (id = (select public.my_couple_id()));
alter policy "koppel wijzigen" on public.couples
  using (id = (select public.my_couple_id()))
  with check (id = (select public.my_couple_id()));
alter policy "leden lezen" on public.couple_members
  using (couple_id = (select public.my_couple_id()));
alter policy "eigen uitnodigingen lezen" on public.invites
  using (created_by = (select auth.uid()));
alter policy "vraag van de dag lezen" on public.couple_daily
  using (couple_id = (select public.my_couple_id()));

alter policy "antwoord lezen: eigen, of partner na eigen antwoord" on public.daily_answers
  using (
    user_id = (select auth.uid())
    or (couple_id = (select public.my_couple_id()) and public.has_answered(couple_id, day))
  );
alter policy "antwoord geven: alleen vandaag, eigen koppel" on public.daily_answers
  with check (
    user_id = (select auth.uid())
    and couple_id = (select public.my_couple_id())
    and day = (select public.ams_today())
  );
alter policy "antwoord aanpassen: alleen vandaag" on public.daily_answers
  using (user_id = (select auth.uid()) and day = (select public.ams_today()))
  with check (
    user_id = (select auth.uid())
    and couple_id = (select public.my_couple_id())
    and day = (select public.ams_today())
  );

alter policy "reageren op antwoord van partner" on public.answer_reactions
  with check (
    user_id = (select auth.uid())
    and public.can_see_answer(answer_id)
    and exists (
      select 1 from public.daily_answers a
      where a.id = answer_id and a.user_id <> (select auth.uid())
    )
  );
alter policy "eigen reactie verwijderen" on public.answer_reactions
  using (user_id = (select auth.uid()));

alter policy "eigen tokens lezen" on public.push_tokens
  using (user_id = (select auth.uid()));
alter policy "eigen token verwijderen" on public.push_tokens
  using (user_id = (select auth.uid()));

alter policy "quizantwoorden lezen" on public.quiz_responses
  using (
    user_id = (select auth.uid())
    or (couple_id = (select public.my_couple_id()) and public.quiz_completed_by(quiz_id, (select auth.uid())))
  );
alter policy "quizantwoord geven" on public.quiz_responses
  with check (
    user_id = (select auth.uid())
    and couple_id = (select public.my_couple_id())
    and not public.quiz_completed_by(quiz_id, (select auth.uid()))
  );
alter policy "quizantwoord aanpassen" on public.quiz_responses
  using (user_id = (select auth.uid()) and not public.quiz_completed_by(quiz_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

alter policy "thema's lezen" on public.themes
  using (not is_explicit or (select public.couple_explicit_enabled(public.my_couple_id())));
alter policy "markeringen lezen" on public.card_marks
  using (couple_id = (select public.my_couple_id()));
alter policy "markering plaatsen" on public.card_marks
  with check (
    couple_id = (select public.my_couple_id())
    and created_by = (select auth.uid())
    and exists (select 1 from public.theme_questions q where q.id = question_id and public.theme_visible(q.theme_id))
  );
alter policy "markering weghalen" on public.card_marks
  using (couple_id = (select public.my_couple_id()));

alter policy "logboek lezen" on public.exercise_completions
  using (couple_id = (select public.my_couple_id()));
alter policy "oefening afvinken" on public.exercise_completions
  with check (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));
alter policy "eigen afvinking weghalen" on public.exercise_completions
  using (user_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

alter policy "plannen lezen" on public.plans
  using (couple_id = (select public.my_couple_id()));
alter policy "plan toevoegen" on public.plans
  with check (couple_id = (select public.my_couple_id()) and created_by = (select auth.uid()));
alter policy "plan aanpassen" on public.plans
  using (couple_id = (select public.my_couple_id()))
  with check (couple_id = (select public.my_couple_id()));
alter policy "plan verwijderen" on public.plans
  using (couple_id = (select public.my_couple_id()));

alter policy "datums lezen" on public.important_dates
  using (couple_id = (select public.my_couple_id()));
alter policy "datum toevoegen" on public.important_dates
  with check (couple_id = (select public.my_couple_id()) and created_by = (select auth.uid()));
alter policy "datum aanpassen" on public.important_dates
  using (couple_id = (select public.my_couple_id()))
  with check (couple_id = (select public.my_couple_id()));
alter policy "datum verwijderen" on public.important_dates
  using (couple_id = (select public.my_couple_id()));

-------------------------------------------------------------------------------
-- 2. Hulpfuncties alleen over jezelf / je eigen koppel
-------------------------------------------------------------------------------

create or replace function public.quiz_completed_by(p_quiz bigint, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_user = auth.uid() or p_user = public.my_partner_id())
    and (
      select count(*) from public.quiz_responses r
      where r.quiz_id = p_quiz
        and r.user_id = p_user
        and r.couple_id = (select couple_id from public.couple_members where user_id = p_user)
    ) = 2 * (select count(*) from public.quiz_questions q where q.quiz_id = p_quiz)
    and exists (select 1 from public.quiz_questions q where q.quiz_id = p_quiz);
$$;

create or replace function public.couple_explicit_enabled(p_couple uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_couple is not null
     and p_couple = public.my_couple_id()
     and (
       select count(*) from public.couple_members m
       join public.profiles p on p.id = m.user_id
       where m.couple_id = p_couple
         and p.explicit_opt_in
         and p.adult_confirmed_at is not null
     ) = 2;
$$;

-------------------------------------------------------------------------------
-- 3. Indexen op foreign keys
-------------------------------------------------------------------------------

create index if not exists answer_reactions_user_idx       on public.answer_reactions (user_id);
create index if not exists card_marks_created_by_idx       on public.card_marks (created_by);
create index if not exists card_marks_question_idx         on public.card_marks (question_id);
create index if not exists couple_daily_question_idx       on public.couple_daily (question_id);
create index if not exists daily_answers_user_idx          on public.daily_answers (user_id);
create index if not exists exercise_completions_ex_idx     on public.exercise_completions (exercise_id);
create index if not exists exercise_completions_user_idx   on public.exercise_completions (user_id);
create index if not exists important_dates_created_by_idx  on public.important_dates (created_by);
create index if not exists invites_created_by_idx          on public.invites (created_by);
create index if not exists invites_used_by_idx             on public.invites (used_by);
create index if not exists plans_created_by_idx            on public.plans (created_by);
create index if not exists plans_date_idea_idx             on public.plans (date_idea_id);
create index if not exists quiz_responses_question_idx     on public.quiz_responses (question_id);
create index if not exists quiz_responses_quiz_id_idx      on public.quiz_responses (quiz_id);
create index if not exists quiz_responses_user_idx         on public.quiz_responses (user_id);
