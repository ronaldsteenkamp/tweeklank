-- Tests: "Ik denk aan je" (één per dag, uit te zetten) en de meldtijd per uur
begin;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl');
update public.profiles set display_name = 'Alex' where id = '11111111-1111-1111-1111-111111111111';
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a'), ('cccccccc-0000-0000-0000-00000000000c');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444');
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[bbb]', '22222222-2222-2222-2222-222222222222', 'ios');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select available from public.nudge_status()), true, 'A kan een duwtje sturen');
select lives_ok($$ select public.send_nudge() $$, 'A stuurt "Ik denk aan je"');
select is((select sent_today from public.nudge_status()), true, 'A ziet dat het vandaag verstuurd is');
select throws_ok($$ select public.send_nudge() $$, 'duwtje_al_verstuurd', 'maar één keer per dag (afgedwongen in de database)');
select throws_ok($$
  insert into public.nudges (couple_id, from_user, to_user, day)
  values (public.my_couple_id(), auth.uid(), public.my_partner_id(), public.ams_today() + 1)
$$, '42501', null, 'om de RPC heen schrijven kan niet');
select throws_ok($$ select * from public.push_targets_nudge(1) $$, '42501', null, 'clients kunnen ontvangers niet opvragen');
reset role;

select results_eq($$ select token, sender_name from public.push_targets_nudge((select id from public.nudges)) $$,
  $$ values ('ExponentPushToken[bbb]', 'Alex') $$, 'de melding gaat naar B, met alleen de naam van A');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*)::int from public.nudges), 0, 'B ziet de duwtjes van A niet in de tabel');
update public.profiles set notify_nudges = false where id = auth.uid();
reset role;

select is((select count(*)::int from public.push_targets_nudge((select id from public.nudges))), 0, 'uitgezet: geen melding meer');
delete from public.nudges;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select available from public.nudge_status()), false, 'A ziet alleen dat de knop niet beschikbaar is');
select throws_ok($$ select public.send_nudge() $$, 'duwtje_niet_beschikbaar', 'versturen lukt dan niet');
reset role;

-- Zonder pushtoken is het ook niet beschikbaar (zelfde antwoord, dus geen reden zichtbaar)
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select available from public.nudge_status()), false, 'partner zonder meldingen: niet beschikbaar');
select throws_ok($$ update public.profiles set notify_hour = 24 where id = auth.uid() $$, '23514', null, 'meldtijd is een uur van 0 t/m 23');
reset role;

-- Meldtijd: elk uur alleen wie dat uur koos, nooit twee keer op een dag
update public.profiles set notify_hour = 9;
update public.profiles set notify_hour = 10 where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set notify_hour = 2 where id = '33333333-3333-3333-3333-333333333333';
select set_eq($$ select public.claim_hourly_users(9, '2026-10-25') $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid), ('44444444-4444-4444-4444-444444444444'::uuid) $$,
  'om 9 uur: alleen wie 9 uur koos');
select is((select count(*)::int from public.claim_hourly_users(9, '2026-10-25')), 0,
  'een tweede keer hetzelfde uur (klok terug) geeft niemand dubbel');
select set_eq($$ select public.claim_hourly_users(10, '2026-10-25') $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$, 'om 10 uur: alleen wie 10 uur koos');
select set_eq($$ select public.claim_hourly_users(3, '2026-03-29') $$,
  $$ values ('33333333-3333-3333-3333-333333333333'::uuid) $$, 'klok vooruit (2 uur bestaat niet): om 3 uur komt 2 uur alsnog aan de beurt');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select throws_ok($$ select public.claim_hourly_users(9) $$, '42501', null, 'clients kunnen het uur niet claimen');
reset role;

select * from finish();
rollback;
