-- Solo-modus: heeft je partner 3 dagen of langer geen dagvraag beantwoord, dan ziet de actieve partner
-- alleen in de app een rustige kaart. Geen push, niets bij de partner, nooit een aantal of datums.
-- Wegklikken kan; de kaart komt hoogstens één keer per 14 dagen terug.

alter table public.profiles add column if not exists solo_card_dismissed_on date;

-- Alleen ja of nee, zodat er geen aantallen of datums over je partner naar de app gaan.
create or replace function public.solo_card_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with x as (
    select public.my_couple_id() as couple, auth.uid() as uid, public.my_partner_id() as partner,
           public.ams_today() as today
  )
  select coalesce((
    select x.partner is not null
       -- het koppel heeft al minstens drie dagen vragen
       and exists (select 1 from public.couple_daily cd where cd.couple_id = x.couple and cd.day <= x.today - 3)
       -- je partner antwoordde niet in de afgelopen drie dagen (en ook vandaag nog niet)
       and not exists (select 1 from public.daily_answers a
                       where a.couple_id = x.couple and a.user_id = x.partner and a.day >= x.today - 3)
       -- jij bent wel actief
       and exists (select 1 from public.daily_answers a
                   where a.couple_id = x.couple and a.user_id = x.uid and a.day >= x.today - 3)
       -- hoogstens één keer per 14 dagen
       and coalesce((select p.solo_card_dismissed_on from public.profiles p where p.id = x.uid), x.today - 14) <= x.today - 14
    from x
  ), false);
$$;

create or replace function public.dismiss_solo_card()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set solo_card_dismissed_on = public.ams_today() where id = auth.uid();
$$;

revoke execute on function public.solo_card_due(), public.dismiss_solo_card() from public, anon;
grant execute on function public.solo_card_due(), public.dismiss_solo_card() to authenticated;
