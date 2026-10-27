-- Content: 5 nieuwe dagelijkse vragen (dv-361 t/m dv-365), origineel geschreven voor Tweeklank.
-- Diepgang: 2 luchtig, 2 persoonlijk, 1 diep.
-- Hiermee zijn er 365 dagvragen: elke dag van het jaar een andere.

insert into public.daily_questions (slug, position, depth, text) values
  ('dv-361', 361, 1, 'Welk liedje vat dit jaar voor jou samen?'),
  ('dv-362', 362, 2, 'Wat heb je dit jaar geleerd over ons?'),
  ('dv-363', 363, 3, 'Wat wil je dat ik weet, nu we weer een jaar lang samen vragen hebben beantwoord?'),
  ('dv-364', 364, 1, 'Wat was het lekkerste dat je dit jaar at?'),
  ('dv-365', 365, 2, 'Waar kijk je het meest naar uit in het komende jaar?')
on conflict (slug) do nothing;
