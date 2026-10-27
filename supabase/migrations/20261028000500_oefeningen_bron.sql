-- Onderbouwing bij oefeningen: een korte, eerlijke regel over waar een oefening op is geïnspireerd.
-- Altijd "geïnspireerd op", nooit "bewezen". De app toont de regel klein onder "Waarom dit helpt".

alter table public.exercises add column if not exists source text check (char_length(source) <= 300);

update public.exercises set source = 'Geïnspireerd op actief luisteren, een gesprekstechniek die teruggaat op het werk van psycholoog Carl Rogers.' where slug = 'ex-luisteren';
update public.exercises set source = 'Geïnspireerd op het onderzoek van John en Julie Gottman naar een zachte start van een moeilijk gesprek (''gentle start-up'').' where slug = 'ex-ikboodschap';
update public.exercises set source = 'Geïnspireerd op het onderzoek van Sara Algoe naar dankbaarheid in relaties.' where slug = 'ex-waardering';
update public.exercises set source = 'Geïnspireerd op het onderzoek van John en Julie Gottman naar ''flooding'' en time-outs.' where slug = 'ex-timeout';
update public.exercises set source = 'Geïnspireerd op het onderzoek van John en Julie Gottman naar herstelpogingen (''repair attempts'').' where slug = 'ex-herstel';
update public.exercises set source = 'Geïnspireerd op het wekelijkse gesprek over de relatie (''State of the Union'') van John en Julie Gottman.' where slug = 'ex-weekgesprek';
update public.exercises set source = 'Geïnspireerd op het idee van John en Julie Gottman dat achter een klacht vaak een wens zit.' where slug = 'ex-wens';
update public.exercises set source = 'Geïnspireerd op Emotionally Focused Therapy (EFT) van Sue Johnson, over nabijheid als bron van veiligheid.' where slug = 'ex-knuffel';
update public.exercises set source = 'Geïnspireerd op het onderzoek van Sara Algoe naar het uitspreken van dankbaarheid.' where slug = 'ex-briefje';
update public.exercises set source = 'Geïnspireerd op het onderzoek van John en Julie Gottman naar kleine toenaderingen (''bids for connection'').' where slug = 'ex-schermvrij';
update public.exercises set source = 'Geïnspireerd op het stressverlagende gesprek (''stress-reducing conversation'') van John en Julie Gottman.' where slug = 'ex-stress';
update public.exercises set source = 'Geïnspireerd op het werk van John en Julie Gottman over gedeelde dromen en betekenis (''shared meaning'').' where slug = 'ex-toekomstdroom';
