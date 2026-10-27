-- Tests: themaweken (aanbod, samen kiezen, onderbreken en hervatten van de rotatie)
begin;
select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');
create temp table c as select 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid as id;
grant select on c to authenticated;

select is((select count(*)::int from public.question_series), 6, 'zes themaweken');
select is((select count(*)::int from public.daily_questions where series_id is not null), 42, 'elk 7 vragen');

-- 59 gewone vragen gehad (vóór vandaag), vandaag nummer 60, en A heeft vandaag geantwoord
insert into public.couple_daily (couple_id, day, question_id)
  select (select id from c), public.ams_today() - 60 + q.position, q.id
  from public.daily_questions q where q.series_id is null and q.position <= 60;
insert into public.daily_answers (couple_id, day, user_id, body)
  values ((select id from c), public.ams_today(), '11111111-1111-1111-1111-111111111111', 'A vandaag');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_series_offer()), 0, 'B heeft vandaag nog niet geantwoord: nog geen aanbod');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_series_offer()), 6, 'na 60 vragen en een eigen antwoord: aanbod van zes series');
select is(public.choose_series((select id from public.question_series where slug = 'tw-geld')), 'wacht', 'A kiest als eerste: wacht op B');
select is((select slug from public.get_series_offer() where i_chose), 'tw-geld', 'A ziet de eigen keuze');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select slug from public.get_series_offer() where partner_chose), 'tw-geld',
  'B ziet de keuze van A, ook zonder eigen antwoord vandaag');
select is(public.choose_series((select id from public.question_series where slug = 'tw-afkomst')), 'wacht',
  'een andere serie kiezen start nog niets');
select is(public.choose_series((select id from public.question_series where slug = 'tw-geld')), 'gestart',
  'allebei dezelfde serie: hij start');
select is((select started_on from public.couple_series), public.ams_today() + 1, 'de vraag van vandaag stond al vast: start morgen');
select is((select count(*)::int from public.series_votes), 0, 'keuzes worden opgeruimd');
select is((select count(*)::int from public.get_series_offer()), 0, 'tijdens een serie geen nieuw aanbod');
select throws_ok($$ select public.choose_series((select id from public.question_series where slug = 'tw-gezin')) $$,
  'serie_al_bezig', 'geen tweede serie tegelijk');
reset role;

-- De serie onderbreekt de rotatie: vandaag laten we hem al starten
delete from public.daily_answers where couple_id = (select id from c) and day = public.ams_today();
delete from public.couple_daily where couple_id = (select id from c) and day = public.ams_today();
update public.couple_series set started_on = public.ams_today();
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select series_title from public.get_today_question()), 'Geld en wij', 'vandaag: themaweek Geld en wij');
select is((select series_step from public.get_today_question()), 1::smallint, 'stap 1 van 7');
reset role;

-- Stap 2 t/m 6 op de volgende dagen, dan stap 7: de serie is klaar en de oefening volgt
insert into public.couple_daily (couple_id, day, question_id)
  select (select id from c), public.ams_today() + q.series_step - 1, q.id
  from public.daily_questions q join public.question_series s on s.id = q.series_id
  where s.slug = 'tw-geld' and q.series_step between 2 and 6;
create temp table step7 as select public.next_series_question((select id from c), public.ams_today() + 6) as qid;
select is((select series_step from public.daily_questions where id = (select qid from step7)),
  7::smallint, 'de zevende dag krijgt stap 7');
select is((select status from public.couple_series), 'klaar', 'na stap 7 is de serie klaar');
select is((select e.slug from public.question_series s join public.exercises e on e.id = s.exercise_id where s.slug = 'tw-geld'),
  'ex-ikboodschap', 'de serie sluit af met een oefening');
select is(public.next_series_question((select id from c), public.ams_today() + 7), null::bigint, 'daarna geen seriesvraag meer');
select is((select q.position from public.pick_regular_question((select id from c), public.ams_today() + 7) p
           join public.daily_questions q on q.id = p.question_id), 60,
  'de gewone rotatie gaat verder waar hij was (vraag 60 was nog niet gesteld)');

-- Nu niet: het aanbod verdwijnt 14 dagen, alleen voor jou
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.dismiss_series_offer(true);
select is((select series_snoozed_until from public.profiles where id = auth.uid()), public.ams_today() + 14, 'aanbod 14 dagen weggezet');
reset role;

-- Ontkoppelen wist de series van het koppel
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select public.leave_couple();
reset role;
select is((select count(*)::int from public.couple_series where couple_id = (select id from c)), 0, 'ontkoppelen wist de themaweken van het koppel');

select * from finish();
rollback;
