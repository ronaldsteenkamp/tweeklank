-- Tests: zichtbaarheid van antwoorden en reacties
begin;
select plan(23);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.nl');

-- Koppel AB en koppel CD direct opzetten
insert into public.couples (id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-00000000000c');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444');

-- A haalt de vraag op en antwoordt
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select position from public.daily_questions where id = (select question_id from public.get_today_question())), 1,
  'eerste dag krijgt de eerste vraag');
select is((select answered from public.get_today_question()), false, 'A heeft nog niet geantwoord');
select lives_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today(), auth.uid(), 'Antwoord van A')
$$, 'A kan antwoorden');
select throws_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today() - 1, auth.uid(), 'te laat')
$$, '42501', null, 'antwoorden op een eerdere dag mag niet');
delete from public.daily_answers where user_id = auth.uid();
select is((select count(*) from public.daily_answers where user_id = auth.uid()), 1::bigint,
  'eigen antwoord verwijderen kan niet (geen delete-policy)');
select lives_ok($$ update public.daily_answers set body = 'Antwoord van A (aangepast)' where user_id = auth.uid() $$,
  'A kan eigen antwoord van vandaag aanpassen');
select is((select body from public.daily_answers where user_id = auth.uid()), 'Antwoord van A (aangepast)', 'aanpassing is opgeslagen');
reset role;

-- B ziet het antwoord van A nog niet
create temp table ans_a as select id from public.daily_answers where user_id = '11111111-1111-1111-1111-111111111111';
grant select on ans_a to authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*) from public.daily_answers), 0::bigint, 'B ziet antwoord van A niet voordat B zelf antwoordt');
select is((select partner_answered from public.get_today_question()), true, 'B ziet wel dat A heeft geantwoord');
select throws_ok($$
  insert into public.answer_reactions (answer_id, user_id, emoji)
  values ((select id from ans_a), auth.uid(), '❤️')
$$, '42501', null, 'B kan niet reageren op een antwoord dat B nog niet mag zien');
update public.daily_answers set body = 'gehackt' where user_id = '11111111-1111-1111-1111-111111111111';
select lives_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today(), auth.uid(), 'Antwoord van B')
$$, 'B antwoordt');
select is((select count(*) from public.daily_answers), 2::bigint, 'na eigen antwoord ziet B beide antwoorden');
select is((select body from public.daily_answers where user_id = '11111111-1111-1111-1111-111111111111'),
  'Antwoord van A (aangepast)', 'B leest het antwoord van A, en de poging van B om het te wijzigen had geen effect');
select lives_ok($$
  insert into public.answer_reactions (answer_id, user_id, emoji, message)
  select id, auth.uid(), '❤️', 'Mooi gezegd' from public.daily_answers where user_id = '11111111-1111-1111-1111-111111111111'
$$, 'B kan reageren op antwoord van A');
reset role;

-- A ziet de reactie, maar kan niet op eigen antwoord reageren
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*) from public.daily_answers), 2::bigint, 'A ziet beide antwoorden');
select is((select count(*) from public.answer_reactions), 1::bigint, 'A ziet de reactie van B');
select throws_ok($$
  insert into public.answer_reactions (answer_id, user_id, emoji)
  select id, auth.uid(), '😂' from public.daily_answers where user_id = auth.uid()
$$, '42501', null, 'reageren op je eigen antwoord kan niet');
reset role;

-- Buitenstaander C ziet niets van koppel AB
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select * from public.get_today_question();
insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today(), auth.uid(), 'Antwoord van C');
select is((select count(*) from public.daily_answers where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint,
  'C ziet geen antwoorden van koppel AB, ook niet na eigen antwoord');
select is((select count(*) from public.answer_reactions), 0::bigint, 'C ziet geen reacties van koppel AB');
select is((select count(*) from public.couple_daily where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint,
  'C ziet de vraag van koppel AB niet');
select throws_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today(), auth.uid(), 'inbraak')
$$, '42501', null, 'C kan niet antwoorden in koppel AB');
reset role;

-- Zonder partner geen dagvraag; 18+ vereist leeftijdsbevestiging
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
set local role authenticated;
select throws_ok($$ select * from public.get_today_question() $$, 'geen_partner', 'zonder partner geen dagvraag');
select throws_ok($$ update public.profiles set explicit_opt_in = true where id = auth.uid() $$, '23514', null,
  '18+-opt-in zonder leeftijdsbevestiging wordt geweigerd');
reset role;

select * from finish();
rollback;
