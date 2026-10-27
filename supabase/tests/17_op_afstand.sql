-- Tests: kaartthema Op afstand, date-ideeën op afstand en de datum "We zien elkaar weer"
begin;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[aaa]', '11111111-1111-1111-1111-111111111111', 'ios');

select is(
  (select array_agg(n order by depth) from (
     select q.depth, count(*)::int as n from public.theme_questions q join public.themes t on t.id = q.theme_id
     where t.slug = 'th-afstand' group by q.depth) d),
  array[5, 5, 5], 'Op afstand: 15 kaarten, 5 per diepgang');
select is((select slug from public.themes order by position desc limit 1), 'th-verlangen', 'de 18+-set blijft achteraan');
select is((select count(*)::int from public.date_ideas where setting = 'op afstand'), 8, 'acht date-ideeën voor op afstand');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*)::int from public.theme_questions q join public.themes t on t.id = q.theme_id where t.slug = 'th-afstand'), 15,
  'het thema is zichtbaar zonder 18+-instelling');
select lives_ok($$
  insert into public.important_dates (couple_id, created_by, title, kind, date, yearly)
  values (public.my_couple_id(), auth.uid(), 'Weekend samen', 'weerzien', public.ams_today() + 10, false)
$$, 'een koppel kan "We zien elkaar weer" toevoegen');
select throws_ok($$
  insert into public.important_dates (couple_id, created_by, title, kind, date)
  values (public.my_couple_id(), auth.uid(), 'Raar', 'iets anders', public.ams_today())
$$, '23514', null, 'onbekende soorten datums worden geweigerd');
reset role;

set local role service_role;
select is((select days_until from public.push_targets_date_reminders((select array_agg(id) from public.profiles), public.ams_today() + 9) limit 1), 1,
  'de herinnering werkt ook voor een weerzien');
reset role;

select * from finish();
rollback;
