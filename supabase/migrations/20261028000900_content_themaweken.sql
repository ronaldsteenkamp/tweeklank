-- Content: 6 themaweken van 7 vragen (origineel geschreven voor Tweeklank).
-- Seriesvragen hebben position 10000+ zodat ze nooit botsen met de gewone dagvragen.

insert into public.question_series (slug, position, title, intro, exercise_id)
select v.slug, v.position, v.title, v.intro, e.id
from (values
  ('tw-ruzie', 1, 'Hoe wij ruzie maken', 'Zeven dagen over onenigheid: wat jullie allebei hebben meegekregen, wat er gebeurt als het botst en hoe jullie weer bij elkaar komen.', 'ex-herstel'),
  ('tw-geld', 2, 'Geld en wij', 'Zeven dagen over geld: wat je hebt meegekregen, wat je ermee wilt en hoe jullie erover praten. Er is geen goed of fout bedrag.', 'ex-ikboodschap'),
  ('tw-afkomst', 3, 'Waar we vandaan komen', 'Zeven dagen over je wortels: plekken, mensen en gewoontes die jou hebben gevormd. Ook als dat ingewikkeld is.', 'ex-luisteren'),
  ('tw-momenten', 4, 'Kleine momenten', 'Zeven dagen over de kleine momenten waarop jullie je naar elkaar toe keren: een blik, een grapje, een vraag. Daar zit vaak meer in dan je denkt.', 'ex-schermvrij'),
  ('tw-afstand', 5, 'Op afstand', 'Zeven dagen voor als jullie niet altijd op dezelfde plek zijn, door werk, wonen of iets anders. Ook fijn als jullie elkaar elke dag zien.', 'ex-knuffel'),
  ('tw-gezin', 6, 'Ons soort gezin', 'Zeven dagen over wat gezin voor jullie betekent. Met of zonder kinderen, samen of apart wonend, met elk een eigen cultuur of geloof. Er is niet één goede vorm.', 'ex-toekomstdroom')
) as v(slug, position, title, intro, exercise_slug)
left join public.exercises e on e.slug = v.exercise_slug
on conflict (slug) do nothing;

insert into public.daily_questions (slug, position, depth, text, series_id, series_step)
select v.slug, v.position, v.depth, v.text, s.id, v.step
from (values
  ('tw-ruzie-1', 'tw-ruzie', 10001, 1, 1, 'Over welk onschuldig onderwerp hebben wij ooit flink gekibbeld?'),
  ('tw-ruzie-2', 'tw-ruzie', 10002, 2, 2, 'Wat zag je als kind gebeuren als volwassenen het oneens waren?'),
  ('tw-ruzie-3', 'tw-ruzie', 10003, 3, 2, 'Wat merk je in je lijf als een gesprek tussen ons begint te schuren?'),
  ('tw-ruzie-4', 'tw-ruzie', 10004, 4, 2, 'Wat zeg of doe ik tijdens onenigheid waardoor jij je juist afsluit?'),
  ('tw-ruzie-5', 'tw-ruzie', 10005, 5, 3, 'Welke angst zit er bij jou onder als we botsen?'),
  ('tw-ruzie-6', 'tw-ruzie', 10006, 6, 2, 'Wat helpt jou om na onenigheid de eerste stap te zetten?'),
  ('tw-ruzie-7', 'tw-ruzie', 10007, 7, 3, 'Waar zijn we de afgelopen tijd beter in geworden als we het oneens zijn?'),
  ('tw-geld-1', 'tw-geld', 10011, 1, 1, 'Waar heb je ooit lang voor gespaard, en was het dat waard?'),
  ('tw-geld-2', 'tw-geld', 10012, 2, 2, 'Welk gevoel geeft geld jou vaker: rust, spanning of iets anders?'),
  ('tw-geld-3', 'tw-geld', 10013, 3, 2, 'Wat leerde je thuis over geld, zonder dat iemand het hardop zei?'),
  ('tw-geld-4', 'tw-geld', 10014, 4, 1, 'Waar geef je met plezier geld aan uit, en waar juist met tegenzin?'),
  ('tw-geld-5', 'tw-geld', 10015, 5, 2, 'Wat zou je willen dat ik weet over hoe jij met geld omgaat?'),
  ('tw-geld-6', 'tw-geld', 10016, 6, 3, 'Wanneer voelde geld tussen ons ongemakkelijk, ook al zeiden we het niet?'),
  ('tw-geld-7', 'tw-geld', 10017, 7, 3, 'Wat betekent ''genoeg'' voor jou?'),
  ('tw-afkomst-1', 'tw-afkomst', 10021, 1, 1, 'Hoe rook of klonk het in het huis waar je opgroeide?'),
  ('tw-afkomst-2', 'tw-afkomst', 10022, 2, 1, 'Welk gerecht of welke snack hoort voor jou bij vroeger?'),
  ('tw-afkomst-3', 'tw-afkomst', 10023, 3, 2, 'Wie was er voor jou toen je klein was, naast de mensen die je opvoedden?'),
  ('tw-afkomst-4', 'tw-afkomst', 10024, 4, 2, 'Welke gewoonte van thuis vond je normaal, tot je zag dat het bij anderen anders ging?'),
  ('tw-afkomst-5', 'tw-afkomst', 10025, 5, 2, 'Welke taal, welk dialect of welke uitdrukking verbindt jou met waar je vandaan komt?'),
  ('tw-afkomst-6', 'tw-afkomst', 10026, 6, 3, 'Wat van vroeger draag je nog mee, terwijl je het liever zou neerleggen?'),
  ('tw-afkomst-7', 'tw-afkomst', 10027, 7, 3, 'Wat van waar je vandaan komt zou je mij graag laten zien?'),
  ('tw-momenten-1', 'tw-momenten', 10031, 1, 1, 'Welk klein gebaar van mij maakt je dag meteen beter?'),
  ('tw-momenten-2', 'tw-momenten', 10032, 2, 1, 'Waar wijs je mij het liefst op: iets moois, iets grappigs of iets geks?'),
  ('tw-momenten-3', 'tw-momenten', 10033, 3, 2, 'Hoe laat jij merken dat je even aandacht wilt, zonder het hardop te vragen?'),
  ('tw-momenten-4', 'tw-momenten', 10034, 4, 2, 'Wanneer had ik onlangs niet door dat je iets met me wilde delen?'),
  ('tw-momenten-5', 'tw-momenten', 10035, 5, 2, 'Welk klein ritueel van ons zou je nooit willen kwijtraken?'),
  ('tw-momenten-6', 'tw-momenten', 10036, 6, 3, 'Wat gebeurt er in jou als ik niet reageer op iets wat je deelt?'),
  ('tw-momenten-7', 'tw-momenten', 10037, 7, 2, 'Welk moment van deze week wil je nog even samen terughalen?'),
  ('tw-afstand-1', 'tw-afstand', 10041, 1, 1, 'Wat is jouw favoriete manier om even contact te hebben als we niet samen zijn?'),
  ('tw-afstand-2', 'tw-afstand', 10042, 2, 1, 'Wat neem je altijd mee als je naar mij toe komt, of wat zou je willen meenemen?'),
  ('tw-afstand-3', 'tw-afstand', 10043, 3, 2, 'Op welk moment voelt het voor jou het zwaarst als we niet bij elkaar zijn?'),
  ('tw-afstand-4', 'tw-afstand', 10044, 4, 2, 'Wat doe je om je verbonden te voelen als we een tijdje niet samen zijn?'),
  ('tw-afstand-5', 'tw-afstand', 10045, 5, 2, 'Wat vind je fijn aan tijd voor jezelf, los van mij?'),
  ('tw-afstand-6', 'tw-afstand', 10046, 6, 3, 'Waar maak je je soms zorgen over als we ver van elkaar zijn?'),
  ('tw-afstand-7', 'tw-afstand', 10047, 7, 3, 'Hoe ziet voor jou de ideale balans tussen samen en apart eruit?'),
  ('tw-gezin-1', 'tw-gezin', 10051, 1, 1, 'Wie hoort er voor jou bij je gezin, ook als het geen familie is?'),
  ('tw-gezin-2', 'tw-gezin', 10052, 2, 2, 'Hoe denk je nu over wel of geen kinderen, en mag dat nog veranderen?'),
  ('tw-gezin-3', 'tw-gezin', 10053, 3, 2, 'Welke feestdagen, rituelen of gebruiken wil je in ons leven een plek geven?'),
  ('tw-gezin-4', 'tw-gezin', 10054, 4, 2, 'Hoe wil je wonen: samen, apart of iets ertussenin, en waarom?'),
  ('tw-gezin-5', 'tw-gezin', 10055, 5, 3, 'Waar verschillen onze achtergronden, en wat wil je daarvan samen bewaren?'),
  ('tw-gezin-6', 'tw-gezin', 10056, 6, 3, 'Wat heb je nodig als er mensen uit eerdere relaties of gezinnen in ons leven zijn, nu of later?'),
  ('tw-gezin-7', 'tw-gezin', 10057, 7, 2, 'Wie wil je over tien jaar om ons heen hebben?')
) as v(slug, series_slug, position, step, depth, text)
join public.question_series s on s.slug = v.series_slug
on conflict (slug) do nothing;
