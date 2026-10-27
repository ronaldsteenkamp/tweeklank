-- Tests: weekritme (samen-dagen, weekdoel, pauze, zomertijd) en het rouleren van dagvragen
begin;
select plan(38);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.nl');
insert into public.couples (id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a'),
  ('bbbbbbbb-0000-0000-0000-00000000000b');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '44444444-4444-4444-4444-444444444444');

-- Hulpjes (als postgres, dus buiten RLS om): één partner of allebei antwoorden op een dag
create function pg_temp.answer(p_couple uuid, p_day date, p_user uuid) returns void language sql as $$
  insert into public.couple_daily (couple_id, day, question_id)
  values (p_couple, p_day, (select min(id) from public.daily_questions))
  on conflict do nothing;
  insert into public.daily_answers (couple_id, day, user_id, body) values (p_couple, p_day, p_user, 'x');
$$;
create function pg_temp.both(p_day date) returns void language sql as $$
  select pg_temp.answer('aaaaaaaa-0000-0000-0000-00000000000a', p_day, '11111111-1111-1111-1111-111111111111');
  select pg_temp.answer('aaaaaaaa-0000-0000-0000-00000000000a', p_day, '22222222-2222-2222-2222-222222222222');
$$;
create function pg_temp.streak(p_day date) returns int language sql as $$
  select public.couple_streak_at('aaaaaaaa-0000-0000-0000-00000000000a', p_day);
$$;

-- Weken lopen van zondag t/m zaterdag: 1–7 maart, 8–14 maart, 15–21 maart, 22–28 maart 2026
select is(pg_temp.streak('2026-03-10'), 0, 'zonder antwoorden is de reeks 0');
select is(public.week_start('2026-03-04'), '2026-03-01'::date, 'een week begint op zondag');
select is(public.week_start('2026-03-07'), '2026-03-01'::date, 'zaterdag hoort bij dezelfde week');
select is(public.week_start('2026-03-08'), '2026-03-08'::date, 'zondag begint een nieuwe week');

-- Eerste week: het koppel begint op donderdag 5 maart, dus het doel is hoogstens 3
select pg_temp.both('2026-03-05');
select pg_temp.both('2026-03-06');
select is(public.couple_effective_goal('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-01'), 3::smallint,
  'eerste week: doel hoogstens het aantal resterende dagen');
select is(pg_temp.streak('2026-03-06'), 0, 'lopende week zonder doel telt nog niet mee');
select pg_temp.both('2026-03-07');
select is(pg_temp.streak('2026-03-07'), 1, 'doel gehaald: de lopende week telt al mee');
select is(pg_temp.streak('2026-03-08'), 1, 'een nieuwe week zonder samen-dagen breekt niets');

-- Week 2: vier samen-dagen en één dag met maar één antwoord
select pg_temp.both('2026-03-08');
select pg_temp.both('2026-03-09');
select pg_temp.both('2026-03-10');
select pg_temp.both('2026-03-11');
select pg_temp.answer('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-13', '11111111-1111-1111-1111-111111111111');
select is(public.couple_together_days('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-08', '2026-03-14'), 4,
  'een dag met één antwoord is geen samen-dag');
select is(pg_temp.streak('2026-03-14'), 1, 'zaterdag 4 van 5: de week is nog niet af en breekt niets');
select is(pg_temp.streak('2026-03-15'), 0, 'week afgelopen met 4 van 5: de reeks begint opnieuw');

-- Ingehaald: de partner antwoordt alsnog op 13 maart
select pg_temp.answer('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-13', '22222222-2222-2222-2222-222222222222');
select is(pg_temp.streak('2026-03-15'), 2, 'een ingehaalde dag telt mee: 5 van 5, twee weken op rij');

-- Weekdoel wijzigen: geldt vanaf die week, eerdere weken houden hun doel
insert into public.couple_week_goals (couple_id, from_week, goal) values ('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-15', 7);
select is(public.couple_week_goal('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-08'), 5::smallint, 'een eerdere week houdt doel 5');
select is(public.couple_week_goal('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-22'), 7::smallint, 'het nieuwe doel geldt ook voor latere weken');
select is(pg_temp.streak('2026-03-15'), 2, 'een hoger doel maakt eerdere weken niet ongedaan');
select pg_temp.both('2026-03-15');
select pg_temp.both('2026-03-16');
select pg_temp.both('2026-03-17');
select pg_temp.both('2026-03-18');
select pg_temp.both('2026-03-19');
select is(pg_temp.streak('2026-03-22'), 0, 'week 3 met 5 van 7 haalt het nieuwe doel niet');

-- Pauze: een gepauzeerde week telt niet mee en breekt de reeks niet
insert into public.couple_pauses (couple_id, start_day, end_day) values ('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-20', '2026-03-20');
select is(public.couple_week_paused('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-15'), true, 'een pauze van één dag pauzeert die hele week');
select is(public.couple_week_paused('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-22'), false, 'de week erna is niet gepauzeerd');
select is(pg_temp.streak('2026-03-22'), 2, 'gepauzeerde week wordt overgeslagen: weer twee weken op rij');
insert into public.couple_pauses (couple_id, start_day, end_day) values ('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-22', null);
select is(pg_temp.streak('2026-04-30'), 2, 'een pauze zonder einddatum houdt de reeks vast');

-- Zomertijd: dagen volgen de Amsterdamse kalender, ook rond de klokwissel
select is(public.ams_day('2026-03-28 22:30+00'), '2026-03-28'::date, 'za 28 maart 23:30 wintertijd is nog zaterdag');
select is(public.ams_day('2026-03-28 23:30+00'), '2026-03-29'::date, 'na middernacht Amsterdamse tijd is het zondag 29 maart');
select is(public.ams_day('2026-10-24 22:30+00'), '2026-10-25'::date, 'zomertijd (UTC+2): 00:30 op zondag 25 oktober');
select is(public.ams_day('2026-10-25 22:30+00'), '2026-10-25'::date, 'wintertijd (UTC+1): 23:30 is nog zondag 25 oktober');
select pg_temp.answer('bbbbbbbb-0000-0000-0000-00000000000b', d::date, u)
from generate_series('2026-10-25'::date, '2026-10-29'::date, '1 day') d,
     unnest(array['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']::uuid[]) u;
select is(public.couple_together_days('bbbbbbbb-0000-0000-0000-00000000000b', '2026-10-25', '2026-10-31'), 5,
  'de week van de klokwissel heeft gewoon zeven dagen');
select is(public.couple_streak_at('bbbbbbbb-0000-0000-0000-00000000000b', '2026-11-01'), 1, 'week met de klokwissel telt mee');

-- Via de app: weekdoel en pauze, alleen voor je eigen koppel
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select throws_ok($$ select public.set_week_goal(8) $$, 'ongeldig_weekdoel', 'een weekdoel boven 7 kan niet');
select lives_ok($$ select public.set_week_goal(4) $$, 'een partner kan het weekdoel kiezen');
select is((select chosen_goal from public.my_week()), 4::smallint, 'het gekozen doel staat in my_week');
select throws_ok($$ select public.start_pause(3) $$, 'ongeldige_pauze', 'alleen 1, 2 of 4 weken (of zonder einde)');
select lives_ok($$ select public.start_pause(2) $$, 'pauze voor twee weken');
select is((select pause_end from public.my_week()), public.ams_today() + 13, 'pauze van twee weken eindigt na 14 dagen');
select throws_ok($$ select public.start_pause(null) $$, 'al_gepauzeerd', 'er is maar één pauze tegelijk');
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
set local role authenticated;
select public.stop_pause();
select is((select pause_active from public.my_week()), false, 'de ander kan de pauze uitzetten (pauze van vandaag verdwijnt)');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*)::int from public.couple_week_goals) + (select count(*)::int from public.couple_pauses), 3,
  'een koppel ziet alleen het eigen weekdoel en de eigen pauzes');
select throws_ok($$ select public.couple_streak_at('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-10') $$,
  '42501', null, 'couple_streak_at is niet publiek');
reset role;

-- Rouleren: vragen die het koppel nog niet had, gaan voor
delete from public.couple_daily where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
insert into public.couple_daily (couple_id, day, question_id)
  select 'aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - g, (select min(id) from public.daily_questions)
  from generate_series(1, (select count(*)::int from public.daily_questions)) g;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select q.position from public.get_today_question() t join public.daily_questions q on q.id = t.question_id), 2,
  'vraag 1 kwam al vaak, dus de eerste nieuwe vraag gaat voor (zie ook 12_rotatie.sql)');
-- Ontkoppelen wist ook weekdoelen en pauzes
select public.leave_couple();
reset role;
select is((select count(*)::int from public.couple_week_goals where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a')
        + (select count(*)::int from public.couple_pauses where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0,
  'ontkoppelen wist weekdoelen en pauzes');

select * from finish();
rollback;
