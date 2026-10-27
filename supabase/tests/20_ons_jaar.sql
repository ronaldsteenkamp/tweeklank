-- Tests: toestemming om "Ons jaar" te delen
begin;
select plan(7);

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
select lives_ok($$ insert into public.year_share_consents (couple_id, period_start, user_id) values (public.my_couple_id(), '2025-10-21', auth.uid()) $$,
  'A geeft toestemming voor dit overzicht');
select throws_ok($$ insert into public.year_share_consents (couple_id, period_start, user_id) values (public.my_couple_id(), '2025-10-21', public.my_partner_id()) $$,
  '42501', null, 'A kan geen toestemming geven namens B');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*)::int from public.year_share_consents), 1, 'B ziet dat A toestemming gaf');
delete from public.year_share_consents where user_id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.year_share_consents), 1, 'B kan de toestemming van A niet intrekken');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*)::int from public.year_share_consents), 0, 'een buitenstaander ziet niets');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
delete from public.year_share_consents where user_id = auth.uid();
select is((select count(*)::int from public.year_share_consents), 0, 'A kan de eigen toestemming intrekken');
insert into public.year_share_consents (couple_id, period_start, user_id) values (public.my_couple_id(), '2025-10-21', auth.uid());
select public.leave_couple();
reset role;
select is((select count(*)::int from public.year_share_consents), 0, 'ontkoppelen wist de toestemmingen');

select * from finish();
rollback;
