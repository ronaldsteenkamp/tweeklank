-- Slimme rotatie en "Een jaar geleden".
--
-- * Een koppel krijgt eerst alle dagvragen die het nog nooit had, in volgorde van position.
-- * Zijn alle vragen gebruikt, dan komt de vraag terug die het langst geleden is gesteld. Die is
--   minimaal 12 maanden geleden als dat kan; anders gewoon de oudste. (De oudste is altijd ook de
--   beste kandidaat voor "minimaal 12 maanden", dus beide regels komen neer op: de oudste.)
-- * couple_daily.repeat_of wijst naar de dag waarop het koppel deze vraag de vorige keer kreeg.
-- * Na je eigen nieuwe antwoord zie je je antwoord van toen (get_year_ago), en dat van je partner
--   van toen onder dezelfde zichtbaarheidsregel: alleen als je die dag zelf ook had geantwoord.
-- * "Een jaar geleden" kun je per persoon uitzetten (profiles.show_year_ago).

alter table public.couple_daily add column if not exists repeat_of date;
alter table public.couple_daily
  add constraint couple_daily_repeat_of_fkey
  foreign key (couple_id, repeat_of) references public.couple_daily (couple_id, day) on delete set null (repeat_of);

alter table public.profiles add column if not exists show_year_ago boolean not null default true;

-- Welke gewone vraag krijgt een koppel op een dag? (intern)
create or replace function public.pick_regular_question(p_couple uuid, p_today date)
returns table (question_id bigint, repeat_of date)
language sql
stable
security definer
set search_path = ''
as $$
  with last_asked as (
    select cd.question_id, max(cd.day) as day
    from public.couple_daily cd
    where cd.couple_id = p_couple and cd.day < p_today
    group by cd.question_id
  ),
  unseen as (
    select q.id as question_id, null::date as repeat_of, 0 as pass, q.position, null::date as day
    from public.daily_questions q
    where not exists (select 1 from last_asked l where l.question_id = q.id)
  ),
  oldest as (
    select l.question_id, l.day as repeat_of, 1 as pass, q.position, l.day
    from last_asked l
    join public.daily_questions q on q.id = l.question_id
  )
  select c.question_id, c.repeat_of
  from (select * from unseen union all select * from oldest) c
  order by c.pass, c.day nulls first, c.position
  limit 1;
$$;

drop function if exists public.get_today_question();

create function public.get_today_question()
returns table (
  day               date,
  question_id       bigint,
  text              text,
  depth             smallint,
  answered          boolean,
  partner_answered  boolean,
  streak            integer,
  repeat_of         date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_couple  uuid := public.my_couple_id();
  v_today   date := public.ams_today();
  v_qid     bigint;
  v_repeat  date;
begin
  if v_uid is null then
    raise exception 'niet_ingelogd';
  end if;
  if v_couple is null or public.my_partner_id() is null then
    raise exception 'geen_partner';
  end if;

  if not exists (select 1 from public.couple_daily cd where cd.couple_id = v_couple and cd.day = v_today) then
    select p.question_id, p.repeat_of into v_qid, v_repeat from public.pick_regular_question(v_couple, v_today) p;
    if v_qid is null then
      raise exception 'geen_vragen';
    end if;
    insert into public.couple_daily (couple_id, day, question_id, repeat_of)
    values (v_couple, v_today, v_qid, v_repeat)
    on conflict do nothing;
  end if;

  return query
  select cd.day, q.id, q.text, q.depth,
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id = v_uid),
         exists (select 1 from public.daily_answers a
                 where a.couple_id = v_couple and a.day = v_today and a.user_id <> v_uid),
         public.couple_streak_at(v_couple, v_today),
         cd.repeat_of
  from public.couple_daily cd
  join public.daily_questions q on q.id = cd.question_id
  where cd.couple_id = v_couple and cd.day = v_today;
end;
$$;

-- De antwoorden van de vorige keer bij een terugkerende vraag. Alleen na je eigen antwoord op p_day,
-- alleen als je "Een jaar geleden" aan hebt staan, en het antwoord van je partner van toen alleen als
-- je die dag zelf ook had geantwoord.
create or replace function public.get_year_ago(p_day date)
returns table (day date, user_id uuid, body text, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.day, a.user_id, a.body, a.user_id = auth.uid()
  from public.couple_daily cd
  join public.daily_answers a on a.couple_id = cd.couple_id and a.day = cd.repeat_of
  where cd.couple_id = public.my_couple_id()
    and cd.day = p_day
    and cd.repeat_of is not null
    and (select p.show_year_ago from public.profiles p where p.id = auth.uid())
    and public.has_answered(cd.couple_id, cd.day)
    and (a.user_id = auth.uid() or public.has_answered(cd.couple_id, cd.repeat_of))
  order by a.user_id = auth.uid() desc;
$$;

revoke execute on function
  public.pick_regular_question(uuid, date),
  public.get_today_question(),
  public.get_year_ago(date)
from public, anon;
revoke execute on function public.pick_regular_question(uuid, date) from authenticated;
grant execute on function public.get_today_question(), public.get_year_ago(date) to authenticated;
