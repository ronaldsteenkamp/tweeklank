-- Tests: oefeningen en het gedeelde logboek
begin;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*) from public.exercises), 12::bigint, 'twaalf oefeningen leesbaar');
select lives_ok($$
  insert into public.exercise_completions (couple_id, exercise_id, user_id, note)
  select public.my_couple_id(), id, auth.uid(), 'Fijn gesprek gehad' from public.exercises where slug = 'ex-luisteren'
$$, 'A vinkt een oefening af met notitie');
select throws_ok($$
  insert into public.exercise_completions (couple_id, exercise_id, user_id)
  select public.my_couple_id(), id, '22222222-2222-2222-2222-222222222222' from public.exercises where slug = 'ex-knuffel'
$$, '42501', null, 'afvinken namens je partner kan niet');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select note from public.exercise_completions), 'Fijn gesprek gehad', 'partner ziet het logboek');
delete from public.exercise_completions;
reset role;
select is((select count(*) from public.exercise_completions), 1::bigint, 'partner kan jouw afvinking niet weghalen');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*) from public.exercise_completions), 0::bigint, 'buitenstaander ziet het logboek niet');
select throws_ok($$
  insert into public.exercise_completions (couple_id, exercise_id, user_id)
  select 'aaaaaaaa-0000-0000-0000-00000000000a', id, auth.uid() from public.exercises where slug = 'ex-knuffel'
$$, '42501', null, 'buitenstaander kan niet afvinken in een ander koppel');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.leave_couple();
reset role;
select is((select count(*) from public.exercise_completions), 0::bigint, 'ontkoppelen wist het logboek');

select * from finish();
rollback;
