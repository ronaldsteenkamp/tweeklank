-- Tests: quizzen (niet spieken, vastleggen, scores, privacy)
begin;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a'), ('cccccccc-0000-0000-0000-00000000000c');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444');

create temp table qz as select id from public.quizzes where slug = 'qz-dagelijks';
grant select on qz to authenticated;

-- Vult als p_user alle 10 vragen in voor p_kind; optie = (positie <= p_split) ? p_first : p_rest
create function pg_temp.fill(p_user uuid, p_kind text, p_split int, p_first int, p_rest int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  set local role authenticated;
  insert into public.quiz_responses (couple_id, quiz_id, question_id, user_id, kind, option_index)
  select public.my_couple_id(), q.quiz_id, q.id, auth.uid(), p_kind,
         case when q.position <= p_split then p_first else p_rest end
  from public.quiz_questions q where q.quiz_id = (select id from qz);
  reset role;
end;
$$;

-- A vult alles in: zelf steeds optie 0, gokt voor B steeds optie 1
select pg_temp.fill('11111111-1111-1111-1111-111111111111', 'self', 10, 0, 0);
select pg_temp.fill('11111111-1111-1111-1111-111111111111', 'guess', 10, 1, 1);
select ok(public.quiz_completed_by((select id from qz), '11111111-1111-1111-1111-111111111111'), 'A heeft de quiz afgerond');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
update public.quiz_responses set option_index = 2 where user_id = auth.uid() and kind = 'guess';
select is((select count(*) from public.quiz_responses where user_id = auth.uid() and option_index = 2), 0::bigint,
  'na afronden kun je je antwoorden niet meer wijzigen');
select throws_ok($$
  insert into public.quiz_responses (couple_id, quiz_id, question_id, user_id, kind, option_index)
  select public.my_couple_id(), quiz_id, id, auth.uid(), 'guess', 3 from public.quiz_questions
  where quiz_id = (select id from qz) and position = 1
  on conflict (couple_id, question_id, user_id, kind) do update set option_index = excluded.option_index
$$, '42501', null, 'ook via upsert niet wijzigen na afronden');
reset role;

-- B vult alleen eigen antwoorden in: vraag 1-5 optie 1, vraag 6-10 optie 0
select pg_temp.fill('22222222-2222-2222-2222-222222222222', 'self', 5, 1, 0);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*) from public.quiz_responses where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'B ziet de antwoorden van A niet zolang B niet klaar is');
select throws_ok($$ select * from public.quiz_result((select id from qz)) $$, 'quiz_niet_klaar', 'uitslag pas als jullie allebei klaar zijn');
select is((select partner_done from public.quiz_overview() where slug = 'qz-dagelijks'), true, 'B ziet wel dat A klaar is');
select is((select my_progress from public.quiz_overview() where slug = 'qz-dagelijks'), 10, 'voortgang van B is 10 van 20');
reset role;

-- A ziet de eigen antwoorden van B al (A is klaar), maar nog geen uitslag
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*) from public.quiz_responses where user_id = '22222222-2222-2222-2222-222222222222'), 10::bigint,
  'wie klaar is, ziet wat de partner tot nu toe invulde');
select is((select my_score from public.quiz_overview() where slug = 'qz-dagelijks'), null::int, 'nog geen score zolang B niet klaar is');
reset role;

-- B gokt voor A steeds optie 0 (allemaal goed)
select pg_temp.fill('22222222-2222-2222-2222-222222222222', 'guess', 10, 0, 0);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select results_eq(
  $$ select my_score, partner_score from public.quiz_overview() where slug = 'qz-dagelijks' $$,
  $$ values (5, 10) $$, 'A raadde 5 goed (B koos 5x optie 1), B raadde alle 10 goed');
select is((select count(*) from public.quiz_result((select id from qz)) where my_self = partner_self), 5::bigint,
  'uitslag toont 5 overeenkomsten');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*) from public.quiz_responses where user_id = '11111111-1111-1111-1111-111111111111'), 20::bigint,
  'na afronden ziet B alle antwoorden van A');
reset role;

-- Buitenstaander C
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*) from public.quiz_responses), 0::bigint, 'C ziet geen quizantwoorden van andere koppels');
select throws_ok($$
  insert into public.quiz_responses (couple_id, quiz_id, question_id, user_id, kind, option_index)
  select 'aaaaaaaa-0000-0000-0000-00000000000a', quiz_id, id, auth.uid(), 'self', 0 from public.quiz_questions
  where quiz_id = (select id from qz) and position = 1
$$, '42501', null, 'C kan niet invullen in koppel AB');
select throws_ok($$
  insert into public.quiz_responses (couple_id, quiz_id, question_id, user_id, kind, option_index)
  select public.my_couple_id(), quiz_id, id, auth.uid(), 'self', 7 from public.quiz_questions
  where quiz_id = (select id from qz) and position = 1
$$, 'ongeldige_optie', 'een niet-bestaande optie wordt geweigerd');
select throws_ok($$
  insert into public.quiz_responses (couple_id, quiz_id, question_id, user_id, kind, option_index)
  select public.my_couple_id(), (select id from public.quizzes where slug = 'qz-eten'), id, auth.uid(), 'self', 0
  from public.quiz_questions where quiz_id = (select id from qz) and position = 1
$$, 'vraag_hoort_niet_bij_quiz', 'vraag moet bij de quiz horen');
reset role;

-- Ontkoppelen wist de quizdata
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select public.leave_couple();
reset role;
select is((select count(*) from public.quiz_responses where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint,
  'ontkoppelen verwijdert alle quizantwoorden');

select * from finish();
rollback;
