-- Startcontent: 5 quizzen × 10 vragen (origineel geschreven voor Tweeklank).
-- Vragen staan in de ik-vorm: je beantwoordt ze voor jezelf en raadt daarna wat je partner koos.
-- Uitbreiden? Nieuwe migratie met extra rijen; slugs moeten uniek blijven.

insert into public.quizzes (slug, position, title, description) values
  ('qz-dagelijks', 1, 'Dagelijkse dingen', 'Ochtendritme, thuiskomen en kleine gewoontes: hoe goed ken je de gewone dagen van je partner?'),
  ('qz-eten', 2, 'Eten & drinken', 'Van ontbijt tot toetje: weet jij wat er op het bord van je partner hoort?'),
  ('qz-vrijetijd', 3, 'Vrije tijd & reizen', 'Vakanties, hobby''s en vrije dagen: wat maakt je partner blij als er niets hoeft?'),
  ('qz-gevoel', 4, 'Gevoel & karakter', 'Hoe reageert je partner op tegenslag, kritiek of liefde? Deze quiz gaat een laagje dieper.'),
  ('qz-toekomst', 5, 'Dromen & toekomst', 'Waar droomt je partner van? Over wonen, werk, avontuur en later samen.')
on conflict (slug) do nothing;

insert into public.quiz_questions (slug, quiz_id, position, prompt, options)
select v.slug, z.id, v.position, v.prompt, v.options::jsonb
from (values
  ('qz-dagelijks-01', 'qz-dagelijks', 1, 'Hoe begin ik het liefst mijn dag?', '["Rustig, met koffie of thee", "Meteen in actie", "Zo lang mogelijk snoozen", "Met muziek of een podcast"]'),
  ('qz-dagelijks-02', 'qz-dagelijks', 2, 'Wat doe ik als eerste als ik thuiskom?', '["Schoenen uit en op de bank", "Iets te eten pakken", "Mijn telefoon checken", "Vertellen hoe mijn dag was"]'),
  ('qz-dagelijks-03', 'qz-dagelijks', 3, 'Hoe ziet mijn ideale zaterdagavond eruit?', '["Thuis met een film", "Uit eten", "Afspreken met vrienden", "Vroeg naar bed"]'),
  ('qz-dagelijks-04', 'qz-dagelijks', 4, 'Welk huishoudelijk klusje vind ik het vervelendst?', '["Afwassen", "Stofzuigen", "Was opvouwen", "Badkamer schoonmaken"]'),
  ('qz-dagelijks-05', 'qz-dagelijks', 5, 'Hoe ga ik om met mijn wekker?', '["Ik sta meteen op", "Eén keer snoozen", "Meerdere keren snoozen", "Ik ben al wakker voordat hij gaat"]'),
  ('qz-dagelijks-06', 'qz-dagelijks', 6, 'Wat is mijn favoriete moment van de dag?', '["De ochtend", "De middag", "De vroege avond", "Laat op de avond"]'),
  ('qz-dagelijks-07', 'qz-dagelijks', 7, 'Hoe houd ik het liefst contact met vrienden?', '["Appen", "Bellen", "Spontaan langsgaan", "Iets plannen in de agenda"]'),
  ('qz-dagelijks-08', 'qz-dagelijks', 8, 'Waar laat ik meestal mijn sleutels?', '["Altijd op dezelfde plek", "In mijn jaszak", "Overal en nergens", "In mijn tas"]'),
  ('qz-dagelijks-09', 'qz-dagelijks', 9, 'Hoe kom ik het liefst tot rust na een drukke dag?', '["Sporten of wandelen", "Een serie kijken", "Lezen", "Praten met iemand"]'),
  ('qz-dagelijks-10', 'qz-dagelijks', 10, 'Wat zit er bijna altijd in mijn tas of zakken?', '["Iets lekkers", "Oordopjes", "Een oplaadkabel", "Bonnetjes en papiertjes"]'),
  ('qz-eten-01', 'qz-eten', 1, 'Wat bestel ik het liefst als we eten laten bezorgen?', '["Pizza", "Sushi", "Indiaas of Thais", "Friet en snacks"]'),
  ('qz-eten-02', 'qz-eten', 2, 'Hoe drink ik mijn koffie of thee?', '["Zwart of puur", "Met melk", "Met suiker", "Ik drink geen koffie of thee"]'),
  ('qz-eten-03', 'qz-eten', 3, 'Welke maaltijd sla ik als eerste over als ik weinig tijd heb?', '["Ontbijt", "Lunch", "Avondeten", "Ik sla nooit iets over"]'),
  ('qz-eten-04', 'qz-eten', 4, 'Wat is mijn ideale toetje?', '["Iets met chocolade", "Fruit", "IJs", "Kaas"]'),
  ('qz-eten-05', 'qz-eten', 5, 'Hoe sta ik in de keuken?', '["Ik kook graag uitgebreid", "Snel en simpel", "Ik volg het recept precies", "Ik laat het koken liever aan een ander over"]'),
  ('qz-eten-06', 'qz-eten', 6, 'Wat zou ik nooit willen eten?', '["Spruitjes", "Orgaanvlees", "Insecten", "Rauwe oesters"]'),
  ('qz-eten-07', 'qz-eten', 7, 'Wat is mijn favoriete snack bij een film?', '["Popcorn", "Chips", "Snoep", "Nootjes"]'),
  ('qz-eten-08', 'qz-eten', 8, 'Hoe ontbijt ik op een vrije dag?', '["Uitgebreid, met eitjes", "Brood met beleg", "Yoghurt of muesli", "Pas tegen de middag iets"]'),
  ('qz-eten-09', 'qz-eten', 9, 'Welke keuken zou ik elke week kunnen eten?', '["Italiaans", "Mexicaans", "Japans", "Hollandse pot"]'),
  ('qz-eten-10', 'qz-eten', 10, 'Hoe pittig mag mijn eten zijn?', '["Helemaal niet pittig", "Een klein beetje", "Lekker pittig", "Hoe heter hoe beter"]'),
  ('qz-vrijetijd-01', 'qz-vrijetijd', 1, 'Wat is voor mij de ideale vakantie?', '["Strand en zon", "Een stedentrip", "Natuur en wandelen", "Een rondreis"]'),
  ('qz-vrijetijd-02', 'qz-vrijetijd', 2, 'Hoe pak ik mijn koffer in?', '["Dagen van tevoren, met een lijstje", "De avond ervoor", "Op het laatste moment", "Ik neem altijd veel te veel mee"]'),
  ('qz-vrijetijd-03', 'qz-vrijetijd', 3, 'Wat doe ik het liefst op een regenachtige zondag?', '["Spelletjes spelen", "Een film of serie kijken", "Bakken of koken", "Toch naar buiten"]'),
  ('qz-vrijetijd-04', 'qz-vrijetijd', 4, 'Welke sport kijk of doe ik het liefst?', '["Voetbal", "Wielrennen", "Tennis", "Ik heb niet zoveel met sport"]'),
  ('qz-vrijetijd-05', 'qz-vrijetijd', 5, 'Waar zou ik ooit nog naartoe willen reizen?', '["Japan", "IJsland", "Zuid-Amerika", "Zuidelijk Afrika"]'),
  ('qz-vrijetijd-06', 'qz-vrijetijd', 6, 'Wat neem ik altijd mee op vakantie?', '["Een boek", "Een goede camera", "Mijn eigen kussen", "Snacks voor onderweg"]'),
  ('qz-vrijetijd-07', 'qz-vrijetijd', 7, 'Hoe ziet mijn perfecte verjaardag eruit?', '["Een groot feest", "Een etentje met een paar mensen", "Iets onverwachts met z''n tweeën", "Liefst zo min mogelijk aandacht"]'),
  ('qz-vrijetijd-08', 'qz-vrijetijd', 8, 'Welk uitje past het best bij mij?', '["Een muziekfestival", "Een theatervoorstelling", "Een museumnacht", "Een rommelmarkt"]'),
  ('qz-vrijetijd-09', 'qz-vrijetijd', 9, 'Hoe plan ik een dagje uit?', '["Alles tot in detail", "Een globaal idee", "Helemaal spontaan", "Ik laat het plannen aan een ander over"]'),
  ('qz-vrijetijd-10', 'qz-vrijetijd', 10, 'Welke hobby zou ik nog willen oppakken?', '["Een instrument leren spelen", "Schilderen of tekenen", "Een nieuwe taal", "Een nieuwe sport"]'),
  ('qz-gevoel-01', 'qz-gevoel', 1, 'Hoe reageer ik meestal als ik boos ben?', '["Ik zeg het meteen", "Ik trek me even terug", "Ik word stil", "Ik ga iets doen om het kwijt te raken"]'),
  ('qz-gevoel-02', 'qz-gevoel', 2, 'Waarmee maak je me het blijst?', '["Een lief berichtje", "Een kleine verrassing", "Samen tijd doorbrengen", "Een knuffel"]'),
  ('qz-gevoel-03', 'qz-gevoel', 3, 'Wat heb ik nodig als ik verdrietig ben?', '["Iemand die luistert", "Afleiding", "Even alleen zijn", "Hulp bij een oplossing"]'),
  ('qz-gevoel-04', 'qz-gevoel', 4, 'Hoe neem ik grote beslissingen?', '["Op mijn gevoel", "Met een lijstje voor- en nadelen", "Ik vraag iedereen om advies", "Ik stel het zo lang mogelijk uit"]'),
  ('qz-gevoel-05', 'qz-gevoel', 5, 'Waar ben ik het vaakst onzeker over?', '["Mijn uiterlijk", "Mijn werk of studie", "Wat anderen van me vinden", "De toekomst"]'),
  ('qz-gevoel-06', 'qz-gevoel', 6, 'Hoe ga ik om met kritiek?', '["Ik denk er rustig over na", "Ik schiet in de verdediging", "Ik lig er wakker van", "Ik leg het snel naast me neer"]'),
  ('qz-gevoel-07', 'qz-gevoel', 7, 'Wat waardeer ik het meest in een vriendschap?', '["Eerlijkheid", "Humor", "Betrouwbaarheid", "Dat ik mezelf kan zijn"]'),
  ('qz-gevoel-08', 'qz-gevoel', 8, 'Wanneer voel ik me het meest zelfverzekerd?', '["Als ik iets goed heb gedaan", "Als ik me goed voel in mijn lijf", "Als ik me gesteund voel", "Als ik goed voorbereid ben"]'),
  ('qz-gevoel-09', 'qz-gevoel', 9, 'Hoe laat ik het liefst merken dat ik om iemand geef?', '["Met woorden", "Door dingen voor iemand te doen", "Met aanraking", "Met kleine cadeautjes"]'),
  ('qz-gevoel-10', 'qz-gevoel', 10, 'Wat is mijn grootste valkuil?', '["Te veel piekeren", "Ongeduld", "Moeilijk nee kunnen zeggen", "Dingen uitstellen"]'),
  ('qz-toekomst-01', 'qz-toekomst', 1, 'Waar zou ik over tien jaar het liefst wonen?', '["In een stad", "In een dorp", "Aan zee", "In het buitenland"]'),
  ('qz-toekomst-02', 'qz-toekomst', 2, 'Wat doe ik met een onverwachte meevaller van 10.000 euro?', '["Sparen", "Een mooie reis maken", "Iets voor ons huis", "Een deel weggeven"]'),
  ('qz-toekomst-03', 'qz-toekomst', 3, 'Welke baan zou ik kiezen als geld geen rol speelde?', '["Iets creatiefs", "Iets met mensen of zorg", "Iets in de natuur", "Mijn eigen bedrijf"]'),
  ('qz-toekomst-04', 'qz-toekomst', 4, 'Hoe kijk ik naar ouder worden?', '["Ik kijk ernaar uit", "Ik denk er liever niet aan", "Ik vind het spannend", "Ik leef vooral in het nu"]'),
  ('qz-toekomst-05', 'qz-toekomst', 5, 'Welk huis past bij mijn toekomstdroom?', '["Een oud huis met karakter", "Iets moderns en lichts", "Een klein huisje met veel buiten", "Een woonboot"]'),
  ('qz-toekomst-06', 'qz-toekomst', 6, 'Wat wil ik ooit nog bereiken?', '["Een boek schrijven", "Een marathon lopen", "Iets maken dat blijft bestaan", "Een andere taal vloeiend spreken"]'),
  ('qz-toekomst-07', 'qz-toekomst', 7, 'Hoe zou ik later mijn dagen willen vullen?', '["Reizen", "Vrijwilligerswerk", "Tuinieren en klussen", "Veel tijd met familie en vrienden"]'),
  ('qz-toekomst-08', 'qz-toekomst', 8, 'Wat vind ik het belangrijkst in ons leven samen?', '["Avontuur", "Rust en stabiliteit", "Samen groeien", "Veel lachen"]'),
  ('qz-toekomst-09', 'qz-toekomst', 9, 'Welk dier zou ik later graag in huis hebben?', '["Een hond", "Een kat", "Kippen in de tuin", "Liever geen huisdier"]'),
  ('qz-toekomst-10', 'qz-toekomst', 10, 'Hoe zou ik ons jubileum over 25 jaar vieren?', '["Met een groot feest", "Met een reis met z''n tweeën", "Terug naar de plek waar het begon", "Rustig thuis, gewoon wij"]')
) as v(slug, quiz_slug, position, prompt, options)
join public.quizzes z on z.slug = v.quiz_slug
on conflict (slug) do nothing;
