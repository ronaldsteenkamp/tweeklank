-- Tests: seizoensdates
begin;
select plan(4);

select is((select count(*)::int from public.date_ideas where slug between 'di-51' and 'di-65'), 15, '15 nieuwe seizoensideeën');
select is((select count(*)::int from public.date_ideas where season is null and slug <= 'di-50'), 50, 'oude ideeën passen het hele jaar');
select is((select holiday from public.date_ideas where slug = 'di-51'), 'sinterklaas', 'de surprise hoort bij Sinterklaas');
select throws_ok($$ update public.date_ideas set season = 'regentijd' where slug = 'di-52' $$, '23514', null, 'alleen de vier seizoenen');

select * from finish();
rollback;
