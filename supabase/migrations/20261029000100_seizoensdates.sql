-- Seizoensdates: date-ideeën met een optioneel seizoen en een optionele feestdag, en 15 nieuwe ideeën
-- die bij Nederland passen. Seizoenen zijn meteorologisch: lente = maart–mei, zomer = juni–augustus,
-- herfst = september–november, winter = december–februari. Zonder seizoen past een idee het hele jaar.

alter table public.date_ideas add column if not exists season text check (season in ('lente', 'zomer', 'herfst', 'winter'));
alter table public.date_ideas add column if not exists holiday text check (holiday in ('sinterklaas', 'koningsdag', 'oud-en-nieuw'));

insert into public.date_ideas (slug, position, title, description, budget, setting, minutes, season, holiday) values
  ('di-51', 51, 'Surprise voor elkaar', 'Knutsel een kleine surprise met een gedicht erbij. Spreek een klein bedrag af, of maak alles van wat je al hebt.', '€', 'binnen', 120, 'winter', 'sinterklaas'),
  ('di-52', 52, 'De eerste lentedag', 'Zodra het voor het eerst echt zacht is: laat even alles liggen en lunch samen buiten.', 'gratis', 'buiten', 90, 'lente', null),
  ('di-53', 53, 'Herfststorm aan zee', 'Trek warme kleren aan, laat je uitwaaien op het strand en zoek daarna een plek voor iets warms.', '€', 'buiten', 180, 'herfst', null),
  ('di-54', 54, 'Koningsdag zonder drukte', 'Sla de drukke straten over. Neem een kleed mee naar een rustig park, of zoek een kleine vrijmarkt in een dorp.', 'gratis', 'buiten', 180, 'lente', 'koningsdag'),
  ('di-55', 55, 'Op het ijs, of ernaast', 'Vriest het? Zoek natuurijs of een ijsbaan. Liever niet op het ijs? Kijk vanaf de kant, met iets warms in je handen.', '€', 'buiten', 120, 'winter', null),
  ('di-56', 56, 'Bloesem zoeken', 'Fiets, wandel of rol langs bloeiende boomgaarden of parken en kies samen de mooiste boom.', 'gratis', 'buiten', 120, 'lente', null),
  ('di-57', 57, 'Zomeravond tot het donker is', 'Zoek een plek op het westen, neem iets te drinken mee en blijf tot de zon helemaal onder is.', 'gratis', 'buiten', 120, 'zomer', null),
  ('di-58', 58, 'Paddenstoelen spotten', 'Ga het bos in en tel hoeveel soorten jullie vinden. Niet plukken, alleen kijken en foto''s maken.', 'gratis', 'buiten', 120, 'herfst', null),
  ('di-59', 59, 'Oliebollen bakken', 'Bak samen oliebollen of appelflappen voor de jaarwisseling, en deel er een paar uit aan de buren.', '€', 'binnen', 150, 'winter', 'oud-en-nieuw'),
  ('di-60', 60, 'De langste dag', 'Gebruik een van de langste dagen van het jaar voor een tocht met veel stops, lopend, rollend of op de fiets.', 'gratis', 'buiten', 360, 'zomer', null),
  ('di-61', 61, 'Wintersoep-avond', 'Maak samen een grote pan soep en nodig iemand uit die wel wat gezelschap kan gebruiken.', '€', 'binnen', 150, 'winter', null),
  ('di-62', 62, 'Vallende sterren tellen', 'Rond half augustus zijn er veel vallende sterren te zien. Zoek een donkere plek, ga liggen en tel samen.', 'gratis', 'buiten', 120, 'zomer', null),
  ('di-63', 63, 'Herfstbladeren-collage', 'Verzamel de mooiste bladeren en maak er samen iets van om op te hangen.', 'gratis', 'binnen', 90, 'herfst', null),
  ('di-64', 64, 'Lichtjesroute', 'Loop in december een rondje langs versierde straten of een lichtjesfestival in de buurt.', 'gratis', 'buiten', 90, 'winter', null),
  ('di-65', 65, 'Zelf plukken', 'Pluk samen aardbeien, bessen of bloemen bij een pluktuin in de buurt.', '€€', 'buiten', 120, 'zomer', null)
on conflict (slug) do nothing;
