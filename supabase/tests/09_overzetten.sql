-- Tests: account overzetten naar een nieuwe telefoon
begin;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', null),
  ('22222222-2222-2222-2222-222222222222', null);

-- Rechten: alleen ingelogd een code maken, alleen de Edge Function (service_role) wisselt in
select ok(not has_function_privilege('anon', 'public.create_transfer_code()', 'execute'), 'anon mag geen overzetcode maken');
select ok(not has_function_privilege('anon', 'public.claim_transfer_code(text)', 'execute'), 'anon mag geen overzetcode inwisselen');
select ok(not has_function_privilege('authenticated', 'public.claim_transfer_code(text)', 'execute'),
  'een ingelogde gebruiker kan geen code inwisselen (alleen de Edge Function)');

-- A maakt een code
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
create temp table code_a1 as select code, expires_at from public.create_transfer_code();
select ok((select code from code_a1) ~ '^[A-HJ-NP-Z2-9]{8}$', 'code heeft 8 tekens zonder verwarrende letters');
select ok((select expires_at from code_a1) between now() + interval '14 minutes' and now() + interval '16 minutes',
  'code is 15 minuten geldig');
select throws_ok($$ select count(*) from public.transfer_codes $$, '42501', null, 'tabel is niet rechtstreeks leesbaar');

-- Een nieuwe code laat de vorige vervallen
create temp table code_a2 as select code from public.create_transfer_code();
grant select on code_a1, code_a2 to service_role;
reset role;
select is((select count(*) from public.transfer_codes), 1::bigint, 'per account maar één geldige code');
select ok((select code_hash from public.transfer_codes) <> (select code from code_a2), 'alleen een hash staat in de database');

-- Inwisselen (als service_role, zoals de Edge Function)
set local role service_role;
select throws_ok(format('select public.claim_transfer_code(%L)', (select code from code_a1)), 'P0001', 'code_onbekend',
  'vervallen code werkt niet meer');
select is(public.claim_transfer_code(lower(' ' || substr((select code from code_a2), 1, 4) || '-' || substr((select code from code_a2), 5))),
  '11111111-1111-1111-1111-111111111111'::uuid, 'code geeft het juiste account (ook met kleine letters, spaties, streepje)');
select throws_ok(format('select public.claim_transfer_code(%L)', (select code from code_a2)), 'P0001', 'code_onbekend',
  'een code werkt maar één keer');
reset role;

-- Verlopen code werkt niet
insert into public.transfer_codes (code_hash, user_id, expires_at)
values (public.transfer_code_hash('OUDCODE2'), '22222222-2222-2222-2222-222222222222', now() - interval '1 minute');
set local role service_role;
select throws_ok($$ select public.claim_transfer_code('OUDCODE2') $$, 'P0001', 'code_onbekend', 'verlopen code werkt niet');
reset role;

-- Herstelcode: 16 tekens, lang geldig, één keer te gebruiken, los van de overzetcode
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is(public.has_recovery_code(), false, 'nog geen herstelcode');
create temp table rc as select public.create_recovery_code() as code;
grant select on rc to service_role;
select ok((select code from rc) ~ '^[A-HJ-NP-Z2-9]{16}$', 'herstelcode heeft 16 tekens zonder verwarrende letters');
select * from public.create_transfer_code();
select is(public.has_recovery_code(), true, 'een nieuwe overzetcode laat de herstelcode staan');
select is((select recovery_card_seen from public.profiles where id = auth.uid()), true, 'de herinneringskaart hoeft niet meer');
reset role;
set local role service_role;
select is(public.claim_transfer_code((select code from rc)), '22222222-2222-2222-2222-222222222222'::uuid, 'herstelcode geeft het juiste account');
select throws_ok(format('select public.claim_transfer_code(%L)', (select code from rc)), 'P0001', 'code_onbekend',
  'een herstelcode werkt maar één keer');
reset role;

select * from finish();
rollback;
