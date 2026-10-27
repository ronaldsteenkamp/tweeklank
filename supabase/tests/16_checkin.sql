-- Tests: maandelijkse check-in (venster, zichtbaarheid, definitief, ontkoppelen)
begin;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');

-- Het venster hangt af van vandaag; we maken het testbaar door ams_today tijdelijk vast te zetten
create or replace function public.ams_today() returns date language sql stable set search_path = '' as $$ select '2026-11-03'::date $$;
select is(public.checkin_open_month(), '2026-11-01'::date, '3 november: de check-in van november is open');
create or replace function public.ams_today() returns date language sql stable set search_path = '' as $$ select '2026-11-08'::date $$;
select is(public.checkin_open_month(), null::date, '8 november: gesloten');
create or replace function public.ams_today() returns date language sql stable set search_path = '' as $$ select '2026-11-07'::date $$;

-- Vorige maand (als postgres): allebei laag op verbondenheid
insert into public.checkins (couple_id, user_id, month, connection, appreciated, conflict, time_together) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', '2026-10-01', 2, 4, 3, 3),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', '2026-10-01', 4, 4, 3, 2);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins where month = '2026-10-01'), 2, 'A ziet oktober van allebei (A vulde oktober in)');
select lives_ok($$
  insert into public.checkins (couple_id, user_id, month, connection, appreciated, conflict, time_together, wish)
  values (public.my_couple_id(), auth.uid(), '2026-11-01', 2, 4, 4, 3, 'Samen naar zee')
$$, 'A vult november in, op dag 7');
select throws_ok($$
  insert into public.checkins (couple_id, user_id, month, connection, appreciated, conflict, time_together)
  values (public.my_couple_id(), auth.uid(), '2026-12-01', 3, 3, 3, 3)
$$, '42501', null, 'een andere maand kan niet');
update public.checkins set connection = 5 where user_id = auth.uid() and month = '2026-11-01';
select is((select connection from public.checkins where user_id = auth.uid() and month = '2026-11-01'), 2::smallint,
  'een ingevulde check-in is definitief');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins where month = '2026-11-01'), 0, 'B ziet november van A nog niet');
insert into public.checkins (couple_id, user_id, month, connection, appreciated, conflict, time_together)
  values (public.my_couple_id(), auth.uid(), '2026-11-01', 4, 3, 3, 2);
select is((select count(*)::int from public.checkins where month = '2026-11-01'), 2, 'na eigen check-in ziet B die van A');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins), 0, 'een buitenstaander ziet niets');
select throws_ok($$
  insert into public.checkins (couple_id, user_id, month, connection, appreciated, conflict, time_together)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', auth.uid(), '2026-11-01', 3, 3, 3, 3)
$$, '42501', null, 'en kan niets invullen voor koppel AB');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.leave_couple();
reset role;
select is((select count(*)::int from public.checkins), 0, 'ontkoppelen wist alle check-ins');

select * from finish();
rollback;
