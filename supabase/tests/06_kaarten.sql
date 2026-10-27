-- Tests: gesprekskaarten, 18+-opt-in en gedeelde markeringen
begin;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.nl'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.nl'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.nl'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.nl'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.nl');
insert into public.couples (id) values ('aaaaaaaa-0000-0000-0000-00000000000a'), ('cccccccc-0000-0000-0000-00000000000c'), ('eeeeeeee-0000-0000-0000-00000000000e');
insert into public.couple_members (couple_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-00000000000c', '33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0000-0000-0000-00000000000c', '44444444-4444-4444-4444-444444444444'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '55555555-5555-5555-5555-555555555555');

-- Gebruiker zet zelf 18+ aan of uit (zoals de app doet)
create function pg_temp.optin(p_user uuid, p_on boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  set local role authenticated;
  update public.profiles
     set adult_confirmed_at = case when p_on then now() else adult_confirmed_at end,
         explicit_opt_in = p_on
   where id = auth.uid();
  reset role;
end;
$$;

create function pg_temp.visible(p_user uuid) returns table (themes bigint, questions bigint) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  set local role authenticated;
  return query select
    (select count(*) from public.themes where is_explicit),
    (select count(*) from public.theme_questions q join public.themes t on t.id = q.theme_id where t.slug = 'th-verlangen');
  reset role;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select is((select count(*) from public.themes where not is_explicit), 9::bigint, 'negen gewone thema''s zichtbaar');
select is((select count(*) from public.theme_questions), 135::bigint, '135 gewone vragen zichtbaar');
reset role;

select results_eq($$ select * from pg_temp.visible('11111111-1111-1111-1111-111111111111') $$, $$ values (0::bigint, 0::bigint) $$,
  '18+ onzichtbaar zonder opt-in');

select pg_temp.optin('11111111-1111-1111-1111-111111111111', true);
select results_eq($$ select * from pg_temp.visible('11111111-1111-1111-1111-111111111111') $$, $$ values (0::bigint, 0::bigint) $$,
  '18+ onzichtbaar als alleen jij het aanzet');

select pg_temp.optin('22222222-2222-2222-2222-222222222222', true);
select results_eq($$ select * from pg_temp.visible('11111111-1111-1111-1111-111111111111') $$, $$ values (1::bigint, 15::bigint) $$,
  '18+ zichtbaar als jullie het allebei aanzetten');
select results_eq($$ select * from pg_temp.visible('22222222-2222-2222-2222-222222222222') $$, $$ values (1::bigint, 15::bigint) $$,
  'ook voor de partner zichtbaar');
select results_eq($$ select * from pg_temp.visible('33333333-3333-3333-3333-333333333333') $$, $$ values (0::bigint, 0::bigint) $$,
  'andere koppels zien de 18+-set niet');

select pg_temp.optin('55555555-5555-5555-5555-555555555555', true);
select results_eq($$ select * from pg_temp.visible('55555555-5555-5555-5555-555555555555') $$, $$ values (0::bigint, 0::bigint) $$,
  'zonder partner geen 18+, ook niet met eigen opt-in');

-- Markeringen
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select lives_ok($$
  insert into public.card_marks (couple_id, question_id, kind, created_by)
  select public.my_couple_id(), id, 'besproken', auth.uid() from public.theme_questions where slug in ('th-geld-01', 'th-verlangen-01')
$$, 'A markeert een gewone en een 18+-kaart als besproken');
select throws_ok($$
  insert into public.card_marks (couple_id, question_id, kind, created_by)
  select public.my_couple_id(), id, 'favoriet', '22222222-2222-2222-2222-222222222222' from public.theme_questions where slug = 'th-geld-02'
$$, '42501', null, 'markeren namens je partner kan niet');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
set local role authenticated;
select is((select count(*) from public.card_marks), 2::bigint, 'markeringen zijn gedeeld met de partner');
reset role;

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
set local role authenticated;
select is((select count(*) from public.card_marks), 0::bigint, 'buitenstaander ziet geen markeringen');
select throws_ok($$
  insert into public.card_marks (couple_id, question_id, kind, created_by)
  select 'aaaaaaaa-0000-0000-0000-00000000000a', id, 'favoriet', auth.uid() from public.theme_questions where slug = 'th-geld-03'
$$, '42501', null, 'markeren in een ander koppel kan niet');
reset role;

-- B zet 18+ weer uit: direct weg voor allebei, en 18+-kaarten kunnen niet meer gemarkeerd worden
create temp table hidden_card as select id from public.theme_questions where slug = 'th-verlangen-02';
grant select on hidden_card to authenticated;
select pg_temp.optin('22222222-2222-2222-2222-222222222222', false);
select results_eq($$ select * from pg_temp.visible('11111111-1111-1111-1111-111111111111') $$, $$ values (0::bigint, 0::bigint) $$,
  'zet één partner 18+ uit, dan verdwijnt het meteen voor allebei');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
set local role authenticated;
select throws_ok($$
  insert into public.card_marks (couple_id, question_id, kind, created_by)
  values (public.my_couple_id(), (select id from hidden_card), 'favoriet', auth.uid())
$$, '42501', null, 'een verborgen 18+-kaart kun je niet markeren, ook niet met het juiste id');
select public.leave_couple();
reset role;
select is((select count(*) from public.card_marks where couple_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 0::bigint,
  'ontkoppelen wist de markeringen');

select * from finish();
rollback;
