-- Tests: koppelen, uitnodigingscodes, ontkoppelen
begin;
select plan(23);

-- Gebruikers (profielen worden via trigger aangemaakt)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.nl'),
  ('66666666-6666-6666-6666-666666666666', 'f@test.nl');

select is((select count(*) from public.profiles), 6::bigint, 'profiel wordt automatisch aangemaakt');

-- A maakt een uitnodiging
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
create temp table code_a as select code from public.create_invite();
select ok((select code from code_a) ~ '^[A-HJ-NP-Z2-9]{6}$', 'code heeft 6 tekens zonder verwarrende letters');
select throws_ok($$ select public.redeem_invite((select code from code_a)) $$, 'eigen_code', 'eigen code inwisselen mag niet');
reset role;

-- B wisselt de code in (ook kleine letters en spaties werken)
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite('QQQQQQ') $$, 'code_onbekend', 'onbekende code geeft nette fout');
select lives_ok($$ select public.redeem_invite(lower(' ' || (select code from code_a) || ' ')) $$, 'partner kan code inwisselen');
select is((select count(*) from public.couple_members), 2::bigint, 'B ziet beide leden van het koppel');
select is((select count(*) from public.profiles), 2::bigint, 'B ziet eigen profiel en dat van A');
reset role;

create temp table ab as
  select couple_id as id from public.couple_members where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select couple_id from public.couple_members where user_id = '22222222-2222-2222-2222-222222222222'),
  (select id from ab), 'A en B zitten in hetzelfde koppel');

-- C probeert dezelfde (gebruikte) code
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite((select code from code_a)) $$, 'code_gebruikt', 'gebruikte code werkt niet nog eens');
select is((select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'buitenstaander ziet profiel van A niet');
select is((select count(*) from public.couple_members), 0::bigint, 'buitenstaander ziet geen koppelleden');
select throws_ok(
  $$ insert into public.couple_members (couple_id, user_id) values ((select id from ab), '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'direct jezelf toevoegen aan een koppel wordt geweigerd door RLS');
reset role;

-- A is al gekoppeld en kan geen nieuwe code maken
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select throws_ok($$ select * from public.create_invite() $$, 'al_gekoppeld', 'gekoppelde gebruiker kan geen nieuwe code maken');
reset role;

-- Verlopen code
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444"}', true);
set local role authenticated;
create temp table code_d as select code from public.create_invite();
reset role;
update public.invites set expires_at = now() - interval '1 minute' where code = (select code from code_d);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite((select code from code_d)) $$, 'code_verlopen', 'verlopen code werkt niet');
reset role;

-- Een vol koppel accepteert geen derde lid (ook niet met een geldige code)
insert into public.invites (code, couple_id, created_by)
  values ('VVVVV2', (select id from ab), '11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite('VVVVV2') $$, 'koppel_vol', 'derde persoon kan niet aansluiten');
reset role;

-- B is al gekoppeld en kan geen andere code inwisselen
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
set local role authenticated;
create temp table code_e as select code from public.create_invite();
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite((select code from code_e)) $$, 'al_gekoppeld', 'gekoppelde gebruiker kan niet nog een code inwisselen');
reset role;

-- E had zelf een wachtende uitnodiging maar wisselt die van F in: E's lege koppel verdwijnt
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666"}', true);
set local role authenticated;
create temp table code_f as select code from public.create_invite();
reset role;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555"}', true);
set local role authenticated;
select lives_ok($$ select public.redeem_invite((select code from code_f)) $$, 'gebruiker met wachtende code kan andermans code inwisselen');
reset role;
select is((select count(*) from public.invites where created_by = '55555555-5555-5555-5555-555555555555'), 0::bigint,
  'oude wachtende uitnodiging is opgeruimd');

-- Ontkoppelen verwijdert alle gedeelde data
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select * from public.get_today_question();
insert into public.daily_answers (couple_id, day, user_id, body)
  values (public.my_couple_id(), public.ams_today(), auth.uid(), 'Mijn antwoord');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select lives_ok($$ select public.leave_couple() $$, 'partner kan ontkoppelen');
reset role;

select is((select count(*) from public.couples where id = (select id from ab)), 0::bigint, 'koppel is verwijderd');
select is((select count(*) from public.daily_answers where couple_id = (select id from ab)), 0::bigint, 'gedeelde antwoorden zijn verwijderd');
select is((select count(*) from public.couple_members where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'A is weer vrij');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select lives_ok($$ select * from public.create_invite() $$, 'na ontkoppelen kan A opnieuw iemand uitnodigen');
reset role;

select * from finish();
rollback;
