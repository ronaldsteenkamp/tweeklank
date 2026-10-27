-- Gisteren inhalen: de vraag van gisteren kun je nog beantwoorden tot het einde van vandaag
-- (Amsterdamse tijd), maar alleen als die vraag gisteren al aan jullie was toegewezen.
-- * Eerder dan gisteren kan niet.
-- * Een ingehaald antwoord is meteen definitief: aanpassen kan alleen op de dag zelf (zoals altijd).
-- * De zichtbaarheidsregel blijft per dag: het antwoord van je partner op gisteren zie je pas na je eigen
--   antwoord op gisteren. Dat geldt ook voor Realtime, want daar gelden dezelfde RLS-regels.

alter policy "antwoord geven: alleen vandaag, eigen koppel" on public.daily_answers
  with check (
    user_id = (select auth.uid())
    and couple_id = (select public.my_couple_id())
    and (
      day = (select public.ams_today())
      or (
        day = (select public.ams_today()) - 1
        and exists (select 1 from public.couple_daily cd where cd.couple_id = daily_answers.couple_id and cd.day = daily_answers.day)
      )
    )
  );

alter policy "antwoord geven: alleen vandaag, eigen koppel" on public.daily_answers
  rename to "antwoord geven: vandaag of gisteren, eigen koppel";

-- De vraag van gisteren, als die er was. Wijst nooit zelf een vraag toe.
-- caught_up: je hebt gisteren vandaag ingehaald (dan toont de app het gesprek nog even op Vandaag).
create or replace function public.get_yesterday_question()
returns table (
  day               date,
  question_id       bigint,
  text              text,
  depth             smallint,
  answered          boolean,
  partner_answered  boolean,
  caught_up         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select cd.day, q.id, q.text, q.depth,
         exists (select 1 from public.daily_answers a
                 where a.couple_id = cd.couple_id and a.day = cd.day and a.user_id = auth.uid()),
         exists (select 1 from public.daily_answers a
                 where a.couple_id = cd.couple_id and a.day = cd.day and a.user_id <> auth.uid()),
         exists (select 1 from public.daily_answers a
                 where a.couple_id = cd.couple_id and a.day = cd.day and a.user_id = auth.uid()
                   and public.ams_day(a.created_at) = public.ams_today())
  from public.couple_daily cd
  join public.daily_questions q on q.id = cd.question_id
  where cd.couple_id = public.my_couple_id()
    and cd.day = public.ams_today() - 1
    and public.my_partner_id() is not null;
$$;

revoke execute on function public.get_yesterday_question() from public, anon;
grant execute on function public.get_yesterday_question() to authenticated;
