-- Quizzen "Hoe goed ken je me?"
-- Iedere partner beantwoordt per vraag twee dingen: wat hij/zij zelf kiest ('self')
-- en wat hij/zij denkt dat de partner kiest ('guess').

create table public.quizzes (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  description  text not null,
  position     integer not null unique
);

create table public.quiz_questions (
  id        bigint generated always as identity primary key,
  slug      text not null unique,
  quiz_id   bigint not null references public.quizzes (id) on delete cascade,
  position  smallint not null,
  prompt    text not null check (char_length(prompt) between 5 and 200),
  options   jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 3 and 4),
  unique (quiz_id, position)
);

create table public.quiz_responses (
  couple_id     uuid not null references public.couples (id) on delete cascade,
  quiz_id       bigint not null references public.quizzes (id) on delete cascade,
  question_id   bigint not null references public.quiz_questions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('self', 'guess')),
  option_index  smallint not null check (option_index >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (couple_id, question_id, user_id, kind)
);

create index quiz_responses_quiz_idx on public.quiz_responses (couple_id, quiz_id);

-- Vraag moet bij de quiz horen en de gekozen optie moet bestaan
create or replace function public.validate_quiz_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_quiz bigint;
  v_len  int;
begin
  select quiz_id, jsonb_array_length(options) into v_quiz, v_len
  from public.quiz_questions where id = new.question_id;
  if v_quiz is distinct from new.quiz_id then
    raise exception 'vraag_hoort_niet_bij_quiz';
  end if;
  if new.option_index >= v_len then
    raise exception 'ongeldige_optie';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger quiz_responses_validate
  before insert or update on public.quiz_responses
  for each row execute function public.validate_quiz_response();

-- Heeft deze gebruiker (binnen zijn/haar huidige koppel) alle vragen voor zichzelf én voor de partner ingevuld?
create or replace function public.quiz_completed_by(p_quiz bigint, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.quiz_responses r
    where r.quiz_id = p_quiz
      and r.user_id = p_user
      and r.couple_id = (select couple_id from public.couple_members where user_id = p_user)
  ) = 2 * (select count(*) from public.quiz_questions q where q.quiz_id = p_quiz)
  and exists (select 1 from public.quiz_questions q where q.quiz_id = p_quiz);
$$;

-- Overzicht voor de quizlijst
create or replace function public.quiz_overview()
returns table (
  quiz_id         bigint,
  slug            text,
  title           text,
  description     text,
  question_count  integer,
  my_progress     integer,
  partner_done    boolean,
  my_score        integer,
  partner_score   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_partner uuid := public.my_partner_id();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_partner is null then
    raise exception 'geen_partner';
  end if;

  return query
  with base as (
    select z.id, z.slug, z.title, z.description, z.position,
           (select count(*)::int from public.quiz_questions q where q.quiz_id = z.id) as qcount,
           (select count(*)::int from public.quiz_responses r
              where r.quiz_id = z.id and r.couple_id = v_couple and r.user_id = v_uid) as progress,
           public.quiz_completed_by(z.id, v_uid) as me_done,
           public.quiz_completed_by(z.id, v_partner) as partner_done
    from public.quizzes z
  )
  select b.id, b.slug, b.title, b.description, b.qcount, b.progress, b.partner_done,
         case when b.me_done and b.partner_done then (
           select count(*)::int
           from public.quiz_responses g
           join public.quiz_responses s
             on s.couple_id = g.couple_id and s.question_id = g.question_id
            and s.user_id = v_partner and s.kind = 'self'
           where g.couple_id = v_couple and g.quiz_id = b.id and g.user_id = v_uid
             and g.kind = 'guess' and g.option_index = s.option_index
         ) end,
         case when b.me_done and b.partner_done then (
           select count(*)::int
           from public.quiz_responses g
           join public.quiz_responses s
             on s.couple_id = g.couple_id and s.question_id = g.question_id
            and s.user_id = v_uid and s.kind = 'self'
           where g.couple_id = v_couple and g.quiz_id = b.id and g.user_id = v_partner
             and g.kind = 'guess' and g.option_index = s.option_index
         ) end
  from base b
  order by b.position;
end;
$$;

-- Volledige uitslag, pas beschikbaar als jullie allebei klaar zijn
create or replace function public.quiz_result(p_quiz bigint)
returns table (
  question_id    bigint,
  "position"     smallint,
  prompt         text,
  options        jsonb,
  my_self        smallint,
  partner_self   smallint,
  my_guess       smallint,
  partner_guess  smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_partner uuid := public.my_partner_id();
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_partner is null then
    raise exception 'geen_partner';
  end if;
  if not (public.quiz_completed_by(p_quiz, v_uid) and public.quiz_completed_by(p_quiz, v_partner)) then
    raise exception 'quiz_niet_klaar';
  end if;

  return query
  select q.id, q.position, q.prompt, q.options,
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_uid and r.kind = 'self'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_partner and r.kind = 'self'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_uid and r.kind = 'guess'),
    (select r.option_index from public.quiz_responses r where r.couple_id = v_couple and r.question_id = q.id and r.user_id = v_partner and r.kind = 'guess')
  from public.quiz_questions q
  where q.quiz_id = p_quiz
  order by q.position;
end;
$$;

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_responses enable row level security;

create policy "quizzen lezen" on public.quizzes for select to authenticated using (true);
create policy "quizvragen lezen" on public.quiz_questions for select to authenticated using (true);

-- Partnerantwoorden pas zichtbaar als je de quiz zelf hebt afgerond (niet spieken)
create policy "quizantwoorden lezen" on public.quiz_responses
  for select to authenticated
  using (
    user_id = auth.uid()
    or (couple_id = public.my_couple_id() and public.quiz_completed_by(quiz_id, auth.uid()))
  );

-- Invullen en aanpassen alleen zolang je zelf nog niet klaar bent
create policy "quizantwoord geven" on public.quiz_responses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and not public.quiz_completed_by(quiz_id, auth.uid())
  );

create policy "quizantwoord aanpassen" on public.quiz_responses
  for update to authenticated
  using (user_id = auth.uid() and not public.quiz_completed_by(quiz_id, auth.uid()))
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());
-- geen delete-policy

revoke execute on function
  public.quiz_completed_by(bigint, uuid),
  public.quiz_overview(),
  public.quiz_result(bigint),
  public.validate_quiz_response()
from public, anon;
grant execute on function
  public.quiz_completed_by(bigint, uuid),
  public.quiz_overview(),
  public.quiz_result(bigint)
to authenticated;
