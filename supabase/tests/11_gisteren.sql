-- Tests: de vraag van gisteren inhalen
begin;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl');
insert into public.couples (id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-00000000000c');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444');

-- Koppel AB kreeg eergisteren en gisteren al een vraag; koppel CD gisteren niet
insert into public.couple_daily (couple_id, day, question_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - 2, (select id from public.daily_questions where position = 1)),
  ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - 1, (select id from public.daily_questions where position = 2));

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select position from public.daily_questions where id = (select question_id from public.get_yesterday_question())), 2,
  'A ziet de vraag van gisteren');
select is((select answered from public.get_yesterday_question()), false, 'A heeft gisteren nog niet geantwoord');
select lives_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today() - 1, auth.uid(), 'Ingehaald door A')
$$, 'A kan de vraag van gisteren nog beantwoorden');
select is((select caught_up from public.get_yesterday_question()), true, 'het antwoord telt als vandaag ingehaald');
select throws_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today() - 2, auth.uid(), 'te laat')
$$, '42501', null, 'eergisteren kan niet meer');
update public.daily_answers set body = 'aangepast' where user_id = auth.uid() and day = public.ams_today() - 1;
select is((select body from public.daily_answers where user_id = auth.uid() and day = public.ams_today() - 1), 'Ingehaald door A',
  'een ingehaald antwoord is definitief');
reset role;

-- B ziet het antwoord van A op gisteren pas na een eigen antwoord op gisteren
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select partner_answered from public.get_yesterday_question()), true, 'B ziet dat A gisteren heeft geantwoord');
select is((select count(*)::int from public.daily_answers where day = public.ams_today() - 1), 0,
  'B ziet het antwoord van A op gisteren nog niet');
select * from public.get_today_question();
insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today(), auth.uid(), 'B vandaag');
select is((select count(*)::int from public.daily_answers where day = public.ams_today() - 1), 0,
  'een antwoord op vandaag opent gisteren niet');
select lives_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today() - 1, auth.uid(), 'Ingehaald door B')
$$, 'B haalt gisteren ook in');
select is((select count(*)::int from public.daily_answers where day = public.ams_today() - 1), 2,
  'nu ziet B beide antwoorden van gisteren');
reset role;

select is(public.couple_together_days('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - 1, public.ams_today() - 1), 1,
  'een ingehaalde dag telt als samen-dag');

-- Koppel CD had gisteren geen vraag: niets in te halen
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*)::int from public.get_yesterday_question()), 0, 'zonder vraag van gisteren is er niets in te halen');
select throws_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today() - 1, auth.uid(), 'geen vraag')
$$, '42501', null, 'antwoorden op een dag zonder toegewezen vraag kan niet');
select throws_ok($$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - 1, auth.uid(), 'inbraak')
$$, '42501', null, 'C kan niet inhalen voor koppel AB');
select is((select count(*)::int from public.daily_answers), 0, 'C ziet niets van koppel AB');
select is((select count(*)::int from public.get_today_question()), 1, 'vandaag werkt gewoon');
reset role;

select * from finish();
rollback;
