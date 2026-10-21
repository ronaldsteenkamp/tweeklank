-- Tests: streaks en het rouleren van dagvragen
begin;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');

-- Hulpje: wie antwoordt op welke dag (als postgres, dus buiten RLS om)
create function pg_temp.answer(p_day date, p_user uuid) returns void language sql as $$
  insert into public.couple_daily (couple_id, day, question_id)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', p_day, (select min(id) from public.daily_questions))
  on conflict do nothing;
  insert into public.daily_answers (couple_id, day, user_id, body)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', p_day, p_user, 'x');
$$;

create temp table c as select 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid as id;

select is(public.couple_streak_at((select id from c), '2026-03-10'), 0, 'zonder antwoorden is de streak 0');

select pg_temp.answer('2026-03-08', '11111111-1111-1111-1111-111111111111');
select pg_temp.answer('2026-03-08', '22222222-2222-2222-2222-222222222222');
select pg_temp.answer('2026-03-09', '11111111-1111-1111-1111-111111111111');
select pg_temp.answer('2026-03-09', '22222222-2222-2222-2222-222222222222');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 2,
  'vandaag nog niet beantwoord: streak telt t/m gisteren en breekt niet');

select pg_temp.answer('2026-03-10', '11111111-1111-1111-1111-111111111111');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 2,
  'vandaag pas één partner: telt nog niet mee');

select pg_temp.answer('2026-03-10', '22222222-2222-2222-2222-222222222222');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 3, 'drie dagen op rij samen geantwoord: 3');

-- Een eerdere reeks voor een gat telt niet mee
select pg_temp.answer('2026-03-05', '11111111-1111-1111-1111-111111111111');
select pg_temp.answer('2026-03-05', '22222222-2222-2222-2222-222222222222');
select pg_temp.answer('2026-03-06', '11111111-1111-1111-1111-111111111111');
select pg_temp.answer('2026-03-06', '22222222-2222-2222-2222-222222222222');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 3, 'een gat (7 maart) breekt de reeks');
select is(public.couple_streak_at((select id from c), '2026-03-06'), 2, 'streak op een eerdere dag klopt ook');

-- Een dag waarop maar één partner antwoordde, breekt de reeks
select pg_temp.answer('2026-03-07', '11111111-1111-1111-1111-111111111111');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 3, 'dag met één antwoord verbindt de reeksen niet');
select pg_temp.answer('2026-03-07', '22222222-2222-2222-2222-222222222222');
select is(public.couple_streak_at((select id from c), '2026-03-10'), 6, 'gat gedicht: 5 t/m 10 maart = 6');

select is(public.couple_streak_at((select id from c), '2026-03-12'), 0, 'een hele dag gemist: streak is 0');

-- Clients kunnen de interne functie niet direct aanroepen (wel my_streak)
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select throws_ok($$ select public.couple_streak_at('aaaaaaaa-0000-0000-0000-00000000000a', '2026-03-10') $$,
  '42501', null, 'couple_streak_at is niet publiek');
reset role;

-- Rouleren: na alle vragen begint de reeks opnieuw bij de eerste
delete from public.couple_daily where couple_id = (select id from c);
insert into public.couple_daily (couple_id, day, question_id)
  select (select id from c), public.ams_today() - g, (select min(id) from public.daily_questions)
  from generate_series(1, (select count(*)::int from public.daily_questions)) g;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select q.position from public.get_today_question() t join public.daily_questions q on q.id = t.question_id), 1,
  'na de laatste vraag begint de rij weer bij vraag 1');
reset role;

select * from finish();
rollback;
