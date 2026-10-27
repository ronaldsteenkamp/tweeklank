-- Tests: de solo-kaart als je partner een tijdje niet antwoordt
begin;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');
insert into public.couple_daily (couple_id, day, question_id)
  select 'aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - g, (select min(id) from public.daily_questions)
  from generate_series(0, 10) g;
create function pg_temp.answer(p_ago int, p_user uuid) returns void language sql as $$
  insert into public.daily_answers (couple_id, day, user_id, body)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', public.ams_today() - p_ago, p_user, 'x');
$$;
create function pg_temp.due_for(p_user uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  set local role authenticated;
  r := public.solo_card_due();
  reset role;
  return r;
end;
$$;

-- B antwoordde 3 dagen geleden voor het laatst, A is actief
select pg_temp.answer(3, '22222222-2222-2222-2222-222222222222');
select pg_temp.answer(1, '11111111-1111-1111-1111-111111111111');
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'partner antwoordde 3 dagen geleden: nog geen kaart');
delete from public.daily_answers where user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.answer(4, '22222222-2222-2222-2222-222222222222');
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), true, 'drie volle dagen en vandaag niets van je partner: kaart');
select is(pg_temp.due_for('22222222-2222-2222-2222-222222222222'), false, 'de partner zelf ziet niets');

-- A was zelf ook niet actief: geen kaart
delete from public.daily_answers where user_id = '11111111-1111-1111-1111-111111111111';
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'alleen voor wie zelf actief is');
select pg_temp.answer(0, '11111111-1111-1111-1111-111111111111');

-- Wegklikken: 14 dagen niet
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.dismiss_solo_card();
reset role;
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'weggeklikt: niet meer zichtbaar');
update public.profiles set solo_card_dismissed_on = public.ams_today() - 13 where id = '11111111-1111-1111-1111-111111111111';
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'na 13 dagen nog niet terug');
update public.profiles set solo_card_dismissed_on = public.ams_today() - 14 where id = '11111111-1111-1111-1111-111111111111';
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), true, 'na 14 dagen mag hij terugkomen');

-- Zodra de partner antwoordt (ook gisteren inhalen), verdwijnt de kaart
select pg_temp.answer(1, '22222222-2222-2222-2222-222222222222');
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'partner antwoordt weer: geen kaart');

-- Een nieuw koppel (minder dan drie dagen) krijgt hem nooit
delete from public.couple_daily where day < public.ams_today() - 2;
delete from public.daily_answers where user_id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.due_for('11111111-1111-1111-1111-111111111111'), false, 'een net gestart koppel krijgt geen kaart');

select * from finish();
rollback;
