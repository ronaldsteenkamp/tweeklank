-- Tests: pushtokens en wie welke melding krijgt
begin;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.nl');
update public.profiles set display_name = 'Anna' where id = '11111111-1111-1111-1111-111111111111';

insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a'), ('cccccccc-0000-0000-0000-00000000000c'), ('eeeeeeee-0000-0000-0000-00000000000e');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '55555555-5555-5555-5555-555555555555');

-- Iedereen (behalve D) registreert een token
create function pg_temp.register(p_user uuid, p_token text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  set local role authenticated;
  perform public.register_push_token(p_token, 'ios');
  reset role;
end;
$$;
select pg_temp.register('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[aaa]');
select pg_temp.register('22222222-2222-2222-2222-222222222222', 'ExponentPushToken[bbb]');
select pg_temp.register('33333333-3333-3333-3333-333333333333', 'ExponentPushToken[ccc]');
select pg_temp.register('55555555-5555-5555-5555-555555555555', 'ExponentPushToken[eee]');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*) from public.push_tokens), 1::bigint, 'je ziet alleen je eigen token (niet dat van je partner)');
select throws_ok($$ insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[xxx]', auth.uid(), 'ios') $$,
  '42501', null, 'tokens direct invoegen kan niet (alleen via register_push_token)');
select throws_ok($$ select * from public.push_targets_new_question() $$, '42501', null, 'clients kunnen ontvangers niet opvragen');
select throws_ok($$ select * from public.push_targets_partner_answered(1) $$, '42501', null, 'clients kunnen partner-ontvangers niet opvragen');
reset role;

-- A antwoordt
insert into public.couple_daily (couple_id, day, question_id)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today(), (select min(id) from public.daily_questions));
insert into public.daily_answers (couple_id, day, user_id, body)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today(), '11111111-1111-1111-1111-111111111111', 'geheim antwoord');
create temp table ans as select id from public.daily_answers where user_id = '11111111-1111-1111-1111-111111111111';
grant select on ans to service_role;

set local role service_role;
select results_eq(
  $$ select token, author_name from public.push_targets_partner_answered((select id from ans)) $$,
  $$ values ('ExponentPushToken[bbb]'::text, 'Anna'::text) $$,
  'alleen de partner krijgt de melding, met de naam van de schrijver');
select results_eq(
  $$ select token from public.push_targets_new_question() order by token $$,
  $$ values ('ExponentPushToken[aaa]'::text), ('ExponentPushToken[bbb]'), ('ExponentPushToken[ccc]') $$,
  'dagmelding gaat naar iedereen met een partner (E zonder partner niet)');
reset role;

-- Instellingen respecteren
update public.profiles set notify_partner_answered = false where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set notify_new_question = false where id = '11111111-1111-1111-1111-111111111111';
set local role service_role;
select is((select count(*) from public.push_targets_partner_answered((select id from ans))), 0::bigint,
  'geen melding als de partner die heeft uitgezet');
select ok(not exists (select 1 from public.push_targets_new_question() where token = 'ExponentPushToken[aaa]'),
  'geen dagmelding als je die hebt uitgezet');
reset role;

-- Toestel wisselt van account: token gaat over naar de nieuwe gebruiker
select pg_temp.register('55555555-5555-5555-5555-555555555555', 'ExponentPushToken[aaa]');
select is((select count(*) from public.push_tokens where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'token wordt overgenomen bij inloggen met een ander account');
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[aaa]'), '55555555-5555-5555-5555-555555555555'::uuid,
  'token hoort nu bij de nieuwe gebruiker');

-- Eigen token verwijderen mag, andermans niet
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
delete from public.push_tokens where token = 'ExponentPushToken[bbb]';
delete from public.push_tokens where token = 'ExponentPushToken[ccc]';
reset role;
select ok(exists (select 1 from public.push_tokens where token = 'ExponentPushToken[bbb]'), 'andermans token verwijderen heeft geen effect');
select ok(not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[ccc]'), 'eigen token verwijderen werkt');

select * from finish();
rollback;
