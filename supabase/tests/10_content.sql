-- Tests: uitgebreide content en de inclusiviteit-pas
begin;
select plan(6);

select is((select count(*)::int from public.daily_questions), 120, '120 dagvragen');
select is((select count(*)::int from public.daily_questions where position between 61 and 120), 60, 'dv-061 t/m dv-120 zijn toegevoegd');
select is(
  (select array_agg(n order by depth) from (select depth, count(*)::int as n from public.daily_questions where position > 60 group by depth) d),
  array[27, 21, 12], 'nieuwe portie: 27 luchtig, 21 persoonlijk, 12 diep');
select is((select count(*)::int from public.exercises where steps::text ~* 'hem of haar|hij of zij' or why ~* 'hem of haar|hij of zij'), 0,
  'geen "hem of haar" of "hij of zij" meer in de oefeningen');
select is((select options->>2 from public.quiz_questions where slug = 'qz-toekomst-02'), 'Iets voor thuis', 'quizoptie gaat niet uit van een gedeeld huis');
select is((select text from public.theme_questions where slug = 'th-verlangen-03'), 'Welke plek, behalve het bed, vind je spannend om te vrijen?',
  'kaarttekst is bijgewerkt');

select * from finish();
rollback;
