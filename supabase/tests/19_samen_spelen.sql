-- Tests: samen kaarten spelen (tijdelijke sessie, alleen het eigen koppel, 18+ blijft dicht)
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
create temp table q as
  select (select id from public.theme_questions where slug = 'th-humor-01') as humor1,
         (select id from public.theme_questions where slug = 'th-humor-02') as humor2,
         (select id from public.theme_questions where slug = 'th-dromen-01') as dromen1,
         (select id from public.theme_questions where slug = 'th-verlangen-01') as verlangen1;
grant select on q to authenticated;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select lives_ok($$ select public.show_card_together((select humor1 from q)) $$, 'A start een sessie op een kaart');
select throws_ok($$ select public.show_card_together((select verlangen1 from q)) $$, 'kaart_niet_beschikbaar',
  '18+-kaarten kunnen niet zonder dubbele toestemming');
select throws_ok($$ insert into public.card_sessions (couple_id, theme_id, question_id) values (public.my_couple_id(), 1, 1) $$,
  '42501', null, 'om de functie heen schrijven kan niet');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select question_id from public.card_sessions), (select humor1 from q), 'B ziet dezelfde kaart');
select public.show_card_together((select humor2 from q));
reset role;
select is((select question_id from public.card_sessions), (select humor2 from q), 'B gaat naar de volgende kaart; A volgt');
select is((select started_by from public.card_sessions), '11111111-1111-1111-1111-111111111111'::uuid, 'binnen hetzelfde thema blijft het dezelfde sessie');

-- Buitenstaander ziet niets
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*)::int from public.card_sessions), 0, 'een buitenstaander ziet de sessie niet');
reset role;

-- Na 2 uur verlopen: onzichtbaar en bij de volgende actie gewist
update public.card_sessions set expires_at = now() - interval '1 second';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*)::int from public.card_sessions), 0, 'een verlopen sessie is niet meer zichtbaar');
select public.show_card_together((select dromen1 from q));
reset role;
select is((select count(*)::int from public.card_sessions where expires_at <= now()), 0, 'verlopen sessies worden gewist');

-- Afsluiten wist de sessie
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select public.end_card_session();
reset role;
select is((select count(*)::int from public.card_sessions), 0, 'afsluiten wist de sessie');

-- Ontkoppelen wist ook een lopende sessie
insert into public.card_sessions (couple_id, theme_id, question_id)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', (select theme_id from public.theme_questions where slug = 'th-humor-01'), (select humor1 from q));
delete from public.couples where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.card_sessions), 0, 'ontkoppelen wist de sessie');

select * from finish();
rollback;
