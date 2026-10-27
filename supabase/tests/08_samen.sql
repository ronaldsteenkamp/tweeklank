-- Tests: plannen, belangrijke datums en herinneringen
begin;
select plan(23);

-- next_occurrence
select is(public.next_occurrence('2020-03-15', true, '2026-03-10'), '2026-03-15'::date, 'jaarlijks: later dit jaar');
select is(public.next_occurrence('2020-03-05', true, '2026-03-10'), '2027-03-05'::date, 'jaarlijks: al geweest, dus volgend jaar');
select is(public.next_occurrence('2020-12-31', true, '2026-12-31'), '2026-12-31'::date, 'jaarlijks: vandaag telt mee');
select is(public.next_occurrence('2024-02-29', true, '2026-02-20'), '2026-02-28'::date, '29 februari valt in een gewoon jaar op 28 februari');
select is(public.next_occurrence('2024-02-29', true, '2028-02-01'), '2028-02-29'::date, '29 februari in een schrikkeljaar');
select is(public.next_occurrence('2026-01-01', false, '2026-03-10'), null::date, 'eenmalig en voorbij: geen volgende keer');
select is(public.next_occurrence('2026-05-01', false, '2026-03-10'), '2026-05-01'::date, 'eenmalig in de toekomst');
select is(public.next_occurrence('2027-06-01', true, '2026-03-10'), '2027-06-01'::date, 'jaarlijks maar nog niet begonnen: de datum zelf');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[aaa]', '11111111-1111-1111-1111-111111111111', 'ios'),
  ('ExponentPushToken[bbb]', '22222222-2222-2222-2222-222222222222', 'android'),
  ('ExponentPushToken[ccc]', '33333333-3333-3333-3333-333333333333', 'ios');

-- Plannen
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select ok((select count(*) from public.date_ideas) >= 50, 'date-ideeën leesbaar');
select lives_ok($$
  insert into public.plans (couple_id, created_by, title, date_idea_id, planned_for)
  select public.my_couple_id(), auth.uid(), title, id, '2026-11-01' from public.date_ideas where slug = 'di-01'
$$, 'A zet een date-idee op de lijst');
select throws_ok($$
  insert into public.plans (couple_id, created_by, title) values (public.my_couple_id(), '22222222-2222-2222-2222-222222222222', 'namens B')
$$, '42501', null, 'een plan toevoegen namens je partner kan niet');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select lives_ok($$ update public.plans set done = true $$, 'B vinkt het plan af');
select throws_ok($$ update public.plans set couple_id = 'aaaaaaaa-0000-0000-0000-00000000000b' $$, '42501', null,
  'het koppel van een plan kun je niet wijzigen');
select lives_ok($$
  insert into public.important_dates (couple_id, created_by, title, kind, date, yearly, remind_days_before) values
    (public.my_couple_id(), auth.uid(), 'Jubileum', 'jubileum', '2020-03-17', true, 7),
    (public.my_couple_id(), auth.uid(), 'Verjaardag Sam', 'verjaardag', '1990-03-10', true, 1),
    (public.my_couple_id(), auth.uid(), 'Concert', 'anders', '2026-03-12', false, 3)
$$, 'B voegt belangrijke datums toe');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select done from public.plans), true, 'A ziet dat B het plan heeft afgevinkt');
select is((select count(*) from public.important_dates), 3::bigint, 'A ziet de datums van B');
select throws_ok($$ select * from public.push_targets_date_reminders((select array_agg(id) from public.profiles), '2026-03-10') $$, '42501', null,
  'clients kunnen herinneringsontvangers niet opvragen');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*) + (select count(*) from public.important_dates) from public.plans), 0::bigint,
  'buitenstaander ziet geen plannen of datums');
reset role;

-- Herinneringen op 10 maart 2026: Jubileum (over 7 dagen) en Verjaardag Sam (vandaag); Concert pas op 9 maart
set local role service_role;
select results_eq($$
  select token, title, days_until from public.push_targets_date_reminders((select array_agg(id) from public.profiles), '2026-03-10') order by title, token
$$, $$ values
  ('ExponentPushToken[aaa]'::text, 'Jubileum'::text, 7), ('ExponentPushToken[bbb]', 'Jubileum', 7),
  ('ExponentPushToken[aaa]', 'Verjaardag Sam', 0), ('ExponentPushToken[bbb]', 'Verjaardag Sam', 0)
$$, 'herinnering 7 dagen vooraf en op de dag zelf, voor beide partners (en niet voor C)');
select results_eq($$ select title, days_until from public.push_targets_date_reminders((select array_agg(id) from public.profiles), '2026-03-09') where token = 'ExponentPushToken[aaa]' order by title $$,
  $$ values ('Concert'::text, 3), ('Verjaardag Sam', 1) $$, 'herinneringen een dag eerder: Concert over 3 dagen, Sam morgen');
reset role;

update public.profiles set notify_dates = false where id = '22222222-2222-2222-2222-222222222222';
set local role service_role;
select is((select count(*) from public.push_targets_date_reminders((select array_agg(id) from public.profiles), '2026-03-10') where token = 'ExponentPushToken[bbb]'), 0::bigint,
  'geen herinneringen voor wie ze heeft uitgezet');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.leave_couple();
reset role;
select is((select count(*) from public.plans), 0::bigint, 'ontkoppelen wist de plannen');
select is((select count(*) from public.important_dates), 0::bigint, 'ontkoppelen wist de datums');

select * from finish();
rollback;
