-- Inclusiviteit: teksten zonder aannames over gender, samenwonen, kinderen, gezondheid of budget.
-- Elke regel past één veld aan via de slug (scripts/check-content.mjs leest deze updates mee).

-- Oefeningen: "hem of haar" en "hij of zij" worden "die" en "de ander"
update public.exercises set steps = '["Spreek af wie begint. Die vertelt vijf minuten over iets wat diegene bezighoudt.", "De ander luistert alleen: geen advies, geen eigen verhaal. Knikken en doorvragen mag wel.", "Vat daarna in je eigen woorden samen wat je hoorde en vraag: ''Klopt dat?''", "Wissel van rol."]'::jsonb where slug = 'ex-luisteren';
update public.exercises set steps = '["Schrijf allebei een verwijt op dat je de ander wel eens maakt, zoals ''Je plant nooit iets leuks''.", "Zoek de wens erachter: wat zou je eigenlijk graag willen?", "Maak er een concreet verzoek van, zoals: ''Wil jij deze maand een avond voor ons bedenken?''", "Lees je verzoeken aan elkaar voor en spreek af wat haalbaar is."]'::jsonb where slug = 'ex-wens';
update public.exercises set why = 'Achter bijna elk verwijt zit een wens. Spreek je die wens uit, dan weet de ander wat die kan doen, in plaats van zich alleen aangevallen te voelen.' where slug = 'ex-wens';
-- Niet elk koppel ziet elkaar elke dag
update public.exercises set steps = '["Spreek af om elkaar minstens één keer twintig seconden lang te knuffelen.", "Laat niet eerder los, ook als het even ongemakkelijk voelt.", "Let op je ademhaling en probeer samen rustiger te ademen.", "Maak er een vast ritueel van, bijvoorbeeld als jullie elkaar zien.", "Zien jullie elkaar vandaag niet? Bel dan even en vertel elkaar waar je naar uitkijkt bij het volgende weerzien."]'::jsonb where slug = 'ex-knuffel';

-- Dagvragen: niet uitgaan van een gedeeld huis of van ouders
update public.daily_questions set text = 'Welke gewoonte uit je opvoeding heb je overgenomen zonder dat je het eigenlijk wilde?' where slug = 'dv-009';
update public.daily_questions set text = 'Welk object in je huis zou je als eerste redden, mensen en dieren niet meegerekend?' where slug = 'dv-045';

-- Gesprekskaarten
update public.theme_questions set text = 'Hoe ziet een thuis er in jouw dromen uit?' where slug = 'th-toekomst-02';
update public.theme_questions set text = 'Hoe denk je over wel of geen kinderen, en over het leven dat we nu samen hebben?' where slug = 'th-toekomst-10';
update public.theme_questions set text = 'Over welk klein dagelijks ding verschillen wij het vaakst van mening?' where slug = 'th-onenigheid-03';
update public.theme_questions set text = 'Hoe verdelen we de dingen die we samen regelen, en voelt dat eerlijk voor jou?' where slug = 'th-samenleven-07';
update public.theme_questions set text = 'Wat vind je moeilijk aan je leven delen met iemand, als je eerlijk bent?' where slug = 'th-samenleven-12';
update public.theme_questions set text = 'Wat heb je meegekregen van de mensen die je hebben opgevoed, waar je dankbaar voor bent?' where slug = 'th-familie-06';
update public.theme_questions set text = 'Welke rol had jij thuis toen je opgroeide?' where slug = 'th-familie-07';
update public.theme_questions set text = 'Wat wil je juist anders doen dan je thuis hebt meegemaakt?' where slug = 'th-familie-11';
update public.theme_questions set text = 'Hoe willen we zorgen voor de mensen in onze families als ze ouder worden?' where slug = 'th-familie-15';
update public.theme_questions set text = 'Welke plek, behalve het bed, vind je spannend om te vrijen?' where slug = 'th-verlangen-03';

-- Quiz: niet uitgaan van een gezamenlijk huis
update public.quiz_questions set options = '["Sparen", "Een mooie reis maken", "Iets voor thuis", "Een deel weggeven"]'::jsonb where slug = 'qz-toekomst-02';

-- Date-ideeën: ook passend bij wie minder mobiel is
update public.date_ideas set title = 'Op pad zonder doel' where slug = 'di-12';
update public.date_ideas set description = 'Lopend, rollend of op de fiets: kies bij elk kruispunt om de beurt links of rechts en kijk waar jullie uitkomen.' where slug = 'di-12';
update public.date_ideas set description = 'Probeer iets wat geen van beiden kent en wat bij jullie lijf past, zoals boulderen, suppen of jeu de boules.' where slug = 'di-14';
