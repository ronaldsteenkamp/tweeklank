-- Tests: slimme rotatie en "Een jaar geleden"
begin;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');

create temp table c as select 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid as id;
create function pg_temp.pick(p_today date) returns int language sql as $$
  select q.position from public.pick_regular_question((select id from c), p_today) p
  join public.daily_questions q on q.id = p.question_id;
$$;
create function pg_temp.assign(p_day date, p_pos int) returns void language sql as $$
  insert into public.couple_daily (couple_id, day, question_id)
  values ((select id from c), p_day, (select id from public.daily_questions where position = p_pos));
$$;

select is(pg_temp.pick('2026-01-10'), 1, 'een nieuw koppel begint bij de eerste vraag');
select pg_temp.assign('2026-01-01', 1);
select pg_temp.assign('2026-01-02', 3);
select is(pg_temp.pick('2026-01-10'), 2, 'een overgeslagen vraag gaat voor: eerst alle nieuwe vragen op volgorde');
select is((select repeat_of from public.pick_regular_question((select id from c), '2026-01-10')), null::date,
  'een nieuwe vraag is geen herhaling');

-- Alle gewone vragen gehad: de oudste komt terug, met een verwijzing naar die dag
delete from public.couple_daily;
insert into public.couple_daily (couple_id, day, question_id)
  select (select id from c), '2025-01-01'::date + q.position, q.id
  from public.daily_questions q;
select is(pg_temp.pick('2026-06-01'), 1, 'alle vragen gebruikt: de vraag die het langst geleden is gesteld komt terug');
select is((select repeat_of from public.pick_regular_question((select id from c), '2026-06-01')), '2025-01-02'::date,
  'repeat_of wijst naar de vorige keer');
-- Vraag 1 is later nog eens gesteld: dan is vraag 2 de oudste
select pg_temp.assign('2026-05-01', 1);
select is(pg_temp.pick('2026-06-01'), 2, 'de laatste keer telt: een recent herhaalde vraag wacht weer achteraan');

-- Via get_today_question: een herhaling met het antwoord van toen
delete from public.couple_daily;
insert into public.couple_daily (couple_id, day, question_id)
  select (select id from c), public.ams_today() - 400 + q.position, q.id
  from public.daily_questions q;
insert into public.daily_answers (couple_id, day, user_id, body) values
  ((select id from c), public.ams_today() - 399, '11111111-1111-1111-1111-111111111111', 'A toen'),
  ((select id from c), public.ams_today() - 399, '22222222-2222-2222-2222-222222222222', 'B toen');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select repeat_of from public.get_today_question()), public.ams_today() - 399, 'vandaag is een herhaling van ruim een jaar geleden');
select is((select count(*)::int from public.get_year_ago(public.ams_today())), 0, 'het antwoord van toen zie je pas na je nieuwe antwoord');
insert into public.daily_answers (couple_id, day, user_id, body) values (public.my_couple_id(), public.ams_today(), auth.uid(), 'A nu');
select is((select body from public.get_year_ago(public.ams_today()) where mine), 'A toen', 'na je nieuwe antwoord zie je je eigen antwoord van toen');
select is((select body from public.get_year_ago(public.ams_today()) where not mine), 'B toen', 'en dat van je partner van toen');
update public.profiles set show_year_ago = false where id = auth.uid();
select is((select count(*)::int from public.get_year_ago(public.ams_today())), 0, '"Een jaar geleden" uitgezet: niets');
reset role;

-- B had toen niet geantwoord als we dat weghalen: dan ziet B het antwoord van A van toen niet
delete from public.daily_answers where user_id = '22222222-2222-2222-2222-222222222222';
insert into public.daily_answers (couple_id, day, user_id, body) values ((select id from c), public.ams_today(), '22222222-2222-2222-2222-222222222222', 'B nu');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_year_ago(public.ams_today())), 0,
  'zonder eigen antwoord van toen blijft het antwoord van je partner van toen verborgen');
reset role;

-- Buitenstaander ziet niets; de interne functie is niet aanroepbaar
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_year_ago(public.ams_today())), 0, 'een buitenstaander ziet niets');
select throws_ok($$ select * from public.pick_regular_question('aaaaaaaa-0000-0000-0000-00000000000a', '2026-01-01') $$,
  '42501', null, 'pick_regular_question is niet publiek');
reset role;

select * from finish();
rollback;
