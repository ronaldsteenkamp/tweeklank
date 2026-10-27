-- Langeafstand en LAT: kaartthema "Op afstand", date-ideeën voor op afstand en de datum "We zien elkaar weer".

alter table public.date_ideas drop constraint if exists date_ideas_setting_check;
alter table public.date_ideas add constraint date_ideas_setting_check check (setting in ('binnen', 'buiten', 'op afstand'));

alter table public.important_dates drop constraint if exists important_dates_kind_check;
alter table public.important_dates add constraint important_dates_kind_check
  check (kind in ('jubileum', 'verjaardag', 'anders', 'weerzien'));

-- De 18+-set blijft achteraan
update public.themes set position = 10 where slug = 'th-verlangen';

insert into public.themes (slug, position, name, description, icon, is_explicit) values
  ('th-afstand', 9, 'Op afstand', 'Over gemis, weerzien en dichtbij blijven als jullie niet op dezelfde plek zijn.', 'airplane-outline', false)
on conflict (slug) do nothing;

insert into public.theme_questions (slug, theme_id, position, depth, text)
select v.slug, t.id, v.position, v.depth, v.text
from (values
  ('th-afstand-01', 'th-afstand', 1, 1, 'Wat wil je als eerste doen als we elkaar weer zien?'),
  ('th-afstand-02', 'th-afstand', 2, 1, 'Welk berichtje van mij maakt je dag als we niet samen zijn?'),
  ('th-afstand-03', 'th-afstand', 3, 1, 'Welke serie zouden we tegelijk kunnen kijken, elk op onze eigen bank?'),
  ('th-afstand-04', 'th-afstand', 4, 1, 'Wat neem je van jouw plek mee naar de mijne, of zou je willen meenemen?'),
  ('th-afstand-05', 'th-afstand', 5, 1, 'Welk geluid hoor jij als we bellen, dat ik nooit zou raden?'),
  ('th-afstand-06', 'th-afstand', 6, 2, 'Hoe vul je een avond als we niet bij elkaar zijn?'),
  ('th-afstand-07', 'th-afstand', 7, 2, 'Wat vind je lastig aan afscheid nemen, en wat helpt dan?'),
  ('th-afstand-08', 'th-afstand', 8, 2, 'Welke gewoonte zou ons helpen om dichtbij te blijven, ook op afstand?'),
  ('th-afstand-09', 'th-afstand', 9, 2, 'Wanneer voel je je het meest verbonden met mij, terwijl we niet samen zijn?'),
  ('th-afstand-10', 'th-afstand', 10, 2, 'Wat zou je willen dat ik vaker vroeg als we bellen?'),
  ('th-afstand-11', 'th-afstand', 11, 3, 'Waar ben je soms onzeker over als we lang niet samen zijn?'),
  ('th-afstand-12', 'th-afstand', 12, 3, 'Wat betekent thuis voor jou als we op twee plekken zijn?'),
  ('th-afstand-13', 'th-afstand', 13, 3, 'Hoe zie je ons over een paar jaar: dichter bij elkaar, of juist zoals nu?'),
  ('th-afstand-14', 'th-afstand', 14, 3, 'Wat heb je van mij nodig als het gemis groot is?'),
  ('th-afstand-15', 'th-afstand', 15, 3, 'Wat leert de afstand ons over elkaar?')
) as v(slug, theme_slug, position, depth, text)
join public.themes t on t.slug = v.theme_slug
on conflict (slug) do nothing;

insert into public.date_ideas (slug, position, title, description, budget, setting, minutes) values
  ('di-43', 43, 'Samen koken op afstand', 'Kies hetzelfde recept, bel elkaar en kook tegelijk. Eet daarna samen via video.', '€', 'op afstand', 90),
  ('di-44', 44, 'Filmavond op afstand', 'Start tegelijk dezelfde film en stuur elkaar berichtjes bij de spannende stukken.', 'gratis', 'op afstand', 150),
  ('di-45', 45, 'Een echte brief', 'Schrijf elkaar een brief per post en open hem samen aan de telefoon.', '€', 'op afstand', 60),
  ('di-46', 46, 'Wandelen en bellen', 'Maak allebei een wandeling of rondje in je eigen buurt en bel onderweg. Laat zien wat je tegenkomt.', 'gratis', 'op afstand', 60),
  ('di-47', 47, 'Quiz voor twee', 'Bedenk voor elkaar tien vragen over iets waar de ander van houdt, en speel ze aan de telefoon.', 'gratis', 'op afstand', 60),
  ('di-48', 48, 'Museum vanaf de bank', 'Kies een museum met een online collectie en geef elkaar een rondleiding langs je favorieten.', 'gratis', 'op afstand', 60),
  ('di-49', 49, 'Pakketje met een verhaal', 'Stuur elkaar iets kleins dat aan jullie doet denken en pak het samen uit aan de telefoon.', '€€', 'op afstand', 60),
  ('di-50', 50, 'Het weerzien plannen', 'Maak samen een lijstje van wat jullie willen doen als jullie elkaar weer zien, en zet de datum in Tweeklank.', 'gratis', 'op afstand', 45)
on conflict (slug) do nothing;
