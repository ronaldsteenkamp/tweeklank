# Tweeklank

Een **volledig gratis** relatie-app voor koppels. Er is geen abonnement, geen premium-laag, geen in-app aankoop en geen advertentie. Ook tracking of analytics van derden zit er niet in.

> **Onze belofte:** Tweeklank blijft gratis. Bestaande functies komen nooit achter een betaalmuur.

Twee partners koppelen hun account en beantwoorden elke dag samen een vraag. Het antwoord van je partner zie je pas als je zelf hebt geantwoord.

## Status

| Fase | Inhoud | Status |
|---|---|---|
| 0 | Expo + TypeScript + expo-router, thema licht/donker, tests | ✅ |
| 1 | Inloggen (zonder e-mail of met inloglink), koppelen/ontkoppelen, dagelijkse vraag, reacties, archief, account verwijderen, 60 vragen | ✅ |
| 2 | Streak-weergave, pushmeldingen | ✅ |
| 3 | Quizzen "Hoe goed ken je me?" (5 × 10) | ✅ |
| 4 | Gesprekskaarten (8 thema's × 15 + 18+-set met dubbele opt-in) | ✅ |
| 5 | Oefeningen & tips | ✅ |
| 6 | Samen plannen: date-ideeën, plannen, belangrijke datums | ✅ |
| 7 | Afronding: toegankelijkheid, lint, privacy, store-voorbereiding | ✅ |
| 8 | Overzetten naar een nieuwe telefoon, eigen icoon, privacypagina | ✅ |
| 9 | Quick wins: 60 extra dagvragen, strengere contentcheck, weekritme met pauze, gisteren inhalen, hulppagina, inclusieve teksten, onderbouwing bij oefeningen, kaarten schudden | ✅ |

## Startcontent

Alles is zelf geschreven, in het Nederlands.

| Onderdeel | Aantal |
|---|---|
| Dagelijkse vragen | 180 (45% luchtig, 35% persoonlijk, 20% diep) |
| Themaweken | 6 series × 7 vragen, elk met intro en afsluitende oefening |
| Quizzen "Hoe goed ken je me?" | 5 × 10 vragen |
| Gesprekskaarten | 8 thema's × 15 kaarten + 18+-set van 15 |
| Oefeningen | 12, elk met een korte onderbouwing ("geïnspireerd op …") |
| Date-ideeën | 42 |

## Techniek

- **App:** Expo SDK 58, React Native, TypeScript, expo-router (`src/app`)
- **Backend:** Supabase (Auth, Postgres, Row Level Security, Realtime, Edge Functions)
- **Content:** vragen staan als SQL-migraties in `supabase/migrations/` en zijn uit te breiden met een nieuwe migratie

```
src/app/            schermen (expo-router)
src/components/     UI-bouwstenen
src/lib/            Supabase-client, API, datum- en codehelpers
src/theme/          kleuren (licht/donker) en ThemeProvider
supabase/migrations schema, RLS, functies en content
supabase/tests      pgTAP-tests (privacy, koppelen, zichtbaarheid, weekritme, meldingen, quiz, kaarten, oefeningen, samen, content)
supabase/functions  Edge Functions (delete-account, send-push, transfer-account)
supabase/sql        eenmalige scripts voor de SQL Editor (cron + trigger voor meldingen)
__tests__/          Jest-tests voor app-logica
docs/               privacyverklaring als webpagina (GitHub Pages)
scripts/            contentcheck, databasetests, iconen en privacypagina maken
```

## Huidige installatie

Het project **tweeklank** draait al:
- **Waar:** organisatie *Tweeslag Wispo*, regio eu-central-1, project-ref `qexufuyxaxvsyaelpfkr`.
- **Wat erin staat:** alle migraties (inclusief `…_hardening.sql` en `…_push_secret.sql`), de Edge Functions `delete-account`, `send-push` en `transfer-account`, de trigger en de cron-jobs voor meldingen.
- **Geheim voor meldingen:** dat is in de database zelf gegenereerd en staat in de Vault als `tweeklank_push_secret`. `send-push` leest het daar zelf uit. Getest: met het juiste geheim antwoordt de functie `200`, met een fout geheim `403`.

> De migraties zijn via de Supabase-connector en de SQL Editor toegepast, met andere namen dan de bestanden in `supabase/migrations/`. Wil je later `npx supabase db push` gebruiken? Draai dan eerst `npx supabase migration repair` (zie de Supabase-documentatie). Je kunt nieuwe migraties ook in de SQL Editor plakken.

## Supabase opzetten

1. **Project aanmaken.** Maak een gratis project aan op [supabase.com](https://supabase.com). Kies bij voorkeur de regio *Central EU (Frankfurt)*.
2. **Sleutels invullen.** Kopieer `.env.example` naar `.env` en vul `EXPO_PUBLIC_SUPABASE_URL` en `EXPO_PUBLIC_SUPABASE_ANON_KEY` in. Je vindt ze onder *Project Settings → API*.
3. **Inloggen zonder e-mail aanzetten.** Ga naar *Authentication → Sign In / Providers* en zet **Allow anonymous sign-ins** aan. Dat is alles.
   - In de app tik je op **Beginnen**. Daarna kies je een naam en koppel je met de uitnodigingscode. Er is geen e-mail of wachtwoord nodig.
   - Het account bestaat alleen op die telefoon. Nieuwe telefoon? Neem het mee met een **overzetcode** (zie stap 5). Ben je je telefoon kwijt zonder code, dan begin je opnieuw. De app waarschuwt hiervoor bij uitloggen.
   - *Optioneel:* via *Liever inloggen met e-mail* kan het ook met een inloglink. Dat werkt pas goed met een eigen SMTP-server, bijvoorbeeld de gratis tier van Brevo. Zet dan ook `exp://**` en `tweeklank://**` bij *Authentication → URL Configuration → Redirect URLs*.
4. **Database vullen.** Zet het schema, de RLS-policies en de vragen in je project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <jouw-project-ref>
   npx supabase db push
   ```
   Heb je liever geen CLI? Plak dan de bestanden uit `supabase/migrations/` op volgorde in de *SQL Editor*.
5. **Account verwijderen en overzetten mogelijk maken.** Deploy de Edge Functions:
   ```bash
   npx supabase functions deploy delete-account
   npx supabase functions deploy transfer-account --no-verify-jwt
   ```
6. **Pushmeldingen.** Dit kun je ook later doen; de app werkt prima zonder.
   1. Deploy de functie: `npx supabase functions deploy send-push --no-verify-jwt`.
   2. Vul in `supabase/sql/cron-en-webhook.sql` je project-URL in en draai het bestand eenmalig in de *SQL Editor*. Dat zet klaar:
      - de triggers voor *"partner heeft geantwoord"* en *"Ik denk aan je"*;
      - één cron-job elk heel uur, die alleen wie dat uur als meldtijd koos de dagmelding en datumherinneringen stuurt (standaard 9:00);
      - een willekeurig geheim in de Vault.

      `send-push` leest dat geheim zelf uit de Vault. Er is dus geen Edge Function-secret nodig.
   3. Koppel de app aan een gratis Expo-account met `npx eas-cli init`. Dat is nodig voor de pushtokens.
7. **Mailserver (optioneel).** Alleen nodig als je ook inloggen met e-mail wilt aanbieden. Stel er een in onder *Authentication → Emails → SMTP Settings*.

## Testen in de browser (zonder installatie)

Open op beide telefoons **https://ronaldsteenkamp.github.io/tweeklank/app/** en tik op **Beginnen**. Dit is dezelfde app als webversie, gekoppeld aan hetzelfde Supabase-project.

- Alles werkt, behalve pushmeldingen. Die werken alleen in de echte app.
- Het account staat in de browser. Gebruik dus op elke telefoon steeds dezelfde browser, en geen privévenster.
- Tip: kies in de browser *Zet op beginscherm*. Dan opent hij als een app.
- De webversie bijwerken na een wijziging: `npm run build:web`, en commit `docs/`.

## Lokaal testen met Expo Go

```bash
npm install
npx expo start
```

De app is al gekoppeld aan het Tweeklank-project, dus je hebt geen `.env` nodig.

1. Scan de QR-code met **Expo Go** (iOS: met de camera, Android: in de Expo Go-app).
2. Tik op **Beginnen**. Je hebt geen e-mail of wachtwoord nodig.
3. Kies een naam en tik op **Maak een code**.
4. Tik op een **tweede toestel** (of een simulator/emulator) ook op **Beginnen** en vul de code in.
5. Beantwoord de dagvraag op toestel 1. Op toestel 2 zie je alleen *"… heeft al geantwoord"*.
6. Antwoord op toestel 2. Nu zien jullie allebei beide antwoorden en kunnen jullie reageren. Bij de ander verschijnt het live.

**Quiz testen.**
1. Open op beide toestellen het tabblad **Quiz** en kies dezelfde quiz.
2. Beantwoord eerst tien vragen over jezelf en raad daarna wat je partner koos.
3. Wie als eerste klaar is, ziet *"Wacht op …"*. Zodra jullie allebei klaar zijn, verschijnt de uitslag met jullie scores, overeenkomsten en verschillen.
4. Na je laatste gok liggen je antwoorden vast.

**Gesprekskaarten testen.**
- Open **Kaarten** en kies een thema.
- Filter op diepgang (luchtig, persoonlijk of diep) en swipe door de kaarten, of gebruik Vorige/Volgende.
- Tik op **Schud** voor een willekeurige volgorde. Die geldt alleen op jouw toestel, zolang het scherm open is, en houdt rekening met het diepgangsfilter. Een schermlezer meldt *"Kaarten geschud"*.
- *Besproken* en *Favoriet* zie je meteen ook op het toestel van je partner, na terug- en weer heengaan.
- **18+-set:** zet onder **Ik → 18+ gesprekskaarten** de schakelaar op **beide** toestellen aan. Pas dan verschijnt *Verlangen (18+)* bij Kaarten. Zet een van jullie hem uit, dan verdwijnt de set direct voor allebei. Dat wordt in de database afgedwongen.

**Samen plannen testen.**
- Open **Samen**, kies een date-idee en tik op *Zet op onze lijst*. Je partner ziet het plan onder *Onze plannen*. Daar kun je het ook afvinken.
- Voeg onder *Belangrijke datums* jullie jubileum toe. Je ziet dan meteen hoeveel dagen het nog duurt en het hoeveelste jaar het wordt.
- Datumherinneringen komen op je eigen meldtijd (standaard 9:00) als pushmelding, bijvoorbeeld *"Over 7 dagen: Jubileum"*. Een datum op 29 februari valt in een gewoon jaar op 28 februari.

**Rotatie en "Een jaar geleden" testen.**
- Een koppel krijgt eerst alle vragen die het nog niet had, op volgorde. Pas daarna komen vragen terug: de vraag die het langst geleden is gesteld.
- Bij een terugkerende vraag verschijnt na je eigen antwoord een ingeklapte kaart *"Een jaar geleden schreef je…"*. Daarin staat je antwoord van toen, en dat van je partner als je die dag zelf ook had geantwoord.
- Uitzetten kan per persoon onder **Ik → Een jaar geleden**.
- Snel proberen zonder een jaar te wachten: zie `supabase/tests/12_rotatie.sql`.

**Themaweken testen.**
- Na de eerste 60 gewone vragen verschijnt op **Vandaag**, nadat je zelf hebt geantwoord, de kaart *Zin in een themaweek?*. Er zijn zes series: *Hoe wij ruzie maken*, *Geld en wij*, *Waar we vandaan komen*, *Kleine momenten*, *Op afstand* en *Ons soort gezin*.
- Wie eerst kiest, ziet *"Wacht op …"*. Kiezen jullie allebei dezelfde, dan begint de serie de volgende dag: zeven vragen met *"dag 3 van 7"*, en op dag 7 een oefening om af te sluiten. Daarna gaan de gewone vragen verder waar ze waren.
- *Nu niet* verbergt het aanbod twee weken, alleen voor jou.
- Zonder 60 dagen te wachten: zie `supabase/tests/13_themaweken.sql`.

**Solo-kaart testen.**
- Heeft je partner drie dagen of langer geen dagvraag beantwoord, terwijl jij wel antwoordt, dan zie je alleen in de app een rustige kaart *Even alleen aan de beurt*. Er gaat geen pushmelding uit en je partner ziet niets.
- De kaart noemt nooit een aantal dagen of datums. Hij bevat een korte uitleg over verschillende behoeften aan nabijheid, één gespreksopener voor buiten de app en onderaan de link naar de hulppagina.
- *Wegklikken* verbergt hem; hij komt hoogstens één keer per 14 dagen terug. Zie `supabase/tests/15_solo.sql`.

**Gisteren inhalen testen.**
- Sla op een dag de vraag over. De volgende dag staat bovenaan **Vandaag** de kaart *Gisteren nog open*.
- Tik op *Nu beantwoorden*. Het antwoord van je partner op gisteren zie je pas als je zelf hebt geantwoord, net als bij vandaag.
- De kaart verschijnt alleen als jullie gisteren al een vraag hadden. Eergisteren kan niet meer. Een ingehaalde dag telt mee als samen-dag.

**Weekritme testen.**
- Een *samen-dag* is een dag waarop jullie allebei de dagvraag beantwoorden. Op **Vandaag** zie je bijvoorbeeld *"4 van 5 samen-dagen deze week"* en *"12 weken op rij"*.
- Een week loopt van zondag tot en met zaterdag (Amsterdamse tijd). De lopende week telt mee zodra het doel gehaald is. Tot die tijd onderbreekt hij niets.
- Kies onder **Ik → Ons weekritme** een weekdoel van 3 tot en met 7 (standaard 5). Een nieuw doel geldt vanaf deze week, eerdere weken houden hun doel.
- Zet daar ook een **pauze** aan: 1, 2 of 4 weken, of tot jullie hem uitzetten. Een gepauzeerde week telt niet mee en onderbreekt de reeks niet. Jullie kunnen hem allebei aan- en uitzetten.
- In de eerste week telt het doel hoogstens het aantal dagen dat er nog over was. Bestaande koppels behouden zo hun voortgang.

**Pushmeldingen testen.**
- **iPhone:** in Expo Go kun je meldingen gewoon aanzetten onder *Ik → Meldingen*.
- **Android:** Expo Go ondersteunt geen pushmeldingen. Maak daarom een development build met `npx eas-cli build --profile development --platform android`. Dat kan gratis. Installeer de APK en start dan `npx expo start`.
- Werkt de trigger? Kijk in de logs van de Edge Function `send-push` in het dashboard.
- Testen zonder op je meldtijd te wachten? Draai in de SQL Editor `select public.notify_push('{"type":"hourly","hour":9}'::jsonb);`. Dat bedient iedereen met meldtijd 9:00 die vandaag nog niets kreeg. Nog een keer proberen: `delete from public.push_daily_log where day = public.ams_today();`.
- **Eigen meldtijd:** kies onder **Ik → Meldingen** met *Eerder* en *Later* het uur van de dagmelding. Eén cron-job per uur bedient alleen wie dat uur koos. Als de klok teruggaat, komt de melding niet dubbel. Als de klok vooruitgaat, komt de melding van het overgeslagen uur een uur later.
- **Ik denk aan je:** op **Vandaag**, één keer per dag per persoon (afgedwongen in de database). De melding is *"[naam] denkt aan je"*, zonder inhoud. De ontvanger kan dit uitzetten onder **Ik → Meldingen**. De verzender ziet dan alleen *"Nu niet beschikbaar"*.

> **Na deze update:** draai `supabase/sql/cron-en-webhook.sql` opnieuw in de SQL Editor en deploy `send-push` opnieuw. Het script vervangt de twee oude cron-jobs (07:00 en 08:00 UTC) door één job per uur en zet de trigger voor *Ik denk aan je* klaar.

**Overzetten naar een nieuwe telefoon testen.**
1. Ga op toestel 1 naar **Ik → Naar een nieuwe telefoon** en tik op *Maak een overzetcode*.
2. Op een derde toestel (of na opnieuw installeren): tik op het inlogscherm op **Ik heb een overzetcode** en vul de code in.
3. Je komt direct binnen met dezelfde naam, koppeling en antwoorden. De code werkt maar één keer en is 15 minuten geldig.
4. Uitloggen op de oude telefoon kan daarna gewoon; dat logt alleen díe telefoon uit.

**Uitnodigingslink.** De link uit *Deel uitnodiging* opent in Expo Go als `exp://…/--/koppel/CODE`. In een echte build wordt dat `tweeklank://koppel/CODE`.

## Tests

```bash
npm test                # Jest: datum/tijdzone, codes, kleurcontrast (WCAG AA), meldingen, quiz, kaarten, plannen
npm run typecheck       # TypeScript
npm run lint            # ESLint (eslint-config-expo)
npm run check:content   # aantallen, (bijna) dubbele vragen, gegenderde woorden en de diepgangsverdeling
npm run test:db         # pgTAP: alle RLS-regels en databaselogica (lokale PostgreSQL + pgTAP, geen Docker nodig)
```

Voor `npm run test:db` heb je PostgreSQL 15+ en pgTAP nodig, bijvoorbeeld via `apt install postgresql-16 postgresql-16-pgtap`. Draai het als gewone gebruiker, niet als root.

Met Docker en de Supabase CLI kan het ook zo: `npx supabase start && npx supabase test db`.

## Privacy by design

- **RLS op elke tabel.** Je leest alleen je eigen data en die van je gekoppelde partner.
- **Verborgen antwoorden.** Het antwoord van je partner blijft in de database zelf onzichtbaar tot je zelf hebt geantwoord. Dat geldt ook voor Realtime.
- **Antwoorden zijn definitief.** Alleen de vraag van gisteren kun je nog inhalen, tot het einde van vandaag. Eerder kan niet. Aanpassen kan alleen op de dag zelf. Een antwoord intrekken nadat je dat van je partner hebt gelezen, kan ook niet.
- **Ontkoppelen wist alles.** Bij ontkoppelen verdwijnt alle gedeelde data voor jullie allebei. *Account verwijderen* wist daarnaast je account.
- **Geen tracking.** Er zitten geen analytics- of advertentie-SDK's in de app.
- **18+ alleen met dubbele toestemming.** De 18+-kaarten zijn in de database onzichtbaar, tenzij beide partners ze zelf aanzetten en bevestigen dat ze 18 of ouder zijn.
- **Meldingen zonder inhoud.** Een pushmelding bevat alleen de naam van je partner, nooit de inhoud van een antwoord.
- **Overzetcodes.** Een overzetcode is 15 minuten en één keer geldig. In de database staat alleen een hash, en alleen de Edge Function kan een code inwisselen.

## Hulppagina "Als het niet goed gaat"

Een statisch scherm (`src/app/hulp.tsx`, gegevens in `src/lib/help.ts`). Je vindt het via een kleine link onder **Ik**, onderaan **Oefeningen** en bij het kaartthema **Onenigheid**. Er wordt niets opgeslagen, er gaat geen melding uit en er is geen analyse.

| Gegeven | Bron | Gecontroleerd |
|---|---|---|
| Veilig Thuis, 0800-2000, gratis, 24/7, anoniem | rijksoverheid.nl en gemeentepagina's (Utrecht, Den Haag) via zoekresultaten | 27-10-2026 |
| 113 Zelfmoordpreventie, 113 en gratis 0800-0113, chat op 113.nl | folder op 113.nl (pdf) en hartvannederland.nl via zoekresultaten | 27-10-2026 |
| Fier, 088-2080000, anoniem contact mogelijk | help.unhcr.org en findahelpline.com via zoekresultaten | 27-10-2026 |
| POH-GGZ bij de huisarts | praktijkwebsites en richtlijnendatabase.nl via zoekresultaten | 27-10-2026 |
| NVRG (nvrg.nl) voor geregistreerde relatie- en gezinstherapeuten | Volkskrant (via eft.nl) en mijnzzp.nl via zoekresultaten | 27-10-2026 |
| 112 bij acuut gevaar | rijksoverheid.nl | 27-10-2026 |

> **Let op:** de officiële websites zelf konden vanuit de bouwomgeving niet worden geopend. Controleer de nummers en links nog een keer op veiligthuis.nl, 113.nl, fier.nl en nvrg.nl voordat je de app naar de stores stuurt.

## Toegankelijkheid

- **Contrast:** alle tekstkleuren halen WCAG AA (≥ 4,5:1) in het lichte en het donkere thema. `__tests__/contrast.test.ts` controleert dat automatisch.
- **Grote tekst:** tekst schaalt mee met de systeeminstelling, tot 2× groot. Containers hebben geen vaste hoogte.
- **Schermlezers:** elk aanklikbaar element heeft een rol en een label (VoiceOver/TalkBack). Lang-indrukacties, zoals een reactie verwijderen, zijn ook als schermlezer-actie beschikbaar.
- **Raakvlakken:** knoppen zijn minimaal 44 punten hoog.

## Naar de App Store en Play Store

De app gebruikt alleen gratis diensten: Supabase free tier, Expo/EAS free tier en Expo Push.

1. **Eigen identiteit.**
   - Pas `ios.bundleIdentifier` en `android.package` in `app.json` aan. Nu staat er `nl.tweeklank.app`. Kies een domein dat je bezit of een unieke naam.
   - Het icoon (twee spraakwolkjes in terracotta, zand en salie) staat in `assets/`. Aanpassen? Wijzig `scripts/make-icons.js` en draai `node scripts/make-icons.js`.
2. **Koppelen aan EAS:** `npx eas-cli login` en `npx eas-cli init`.
3. **Productiebuild:**
   ```bash
   npx eas-cli build --profile production --platform all
   ```
4. **Indienen:** `npx eas-cli submit --platform ios` en `--platform android`. Hiervoor heb je een Apple Developer-account (€99 per jaar) en een Google Play-ontwikkelaarsaccount (eenmalig $25) nodig. De app zelf blijft gratis.
5. **Store-gegevens.**
   - **Leeftijdsclassificatie:** door de optionele 18+-kaarten is 17+ (App Store) of *Mature/18+* (Play Store) het verstandigst. Vermeld dat de 18+-content standaard uit staat.
   - **Privacylabels:** er is geen tracking. De app verzamelt een naam en door de gebruiker gemaakte content (antwoorden, plannen), en alleen als iemand daarvoor kiest een e-mailadres. Alles uitsluitend voor de werking van de app en niet gekoppeld aan advertenties.
   - **Account verwijderen in de app:** dat is verplicht voor beide stores en zit al in de app, onder *Ik → Account verwijderen*.
6. **Concepttekst voor de store.**
   > **Tweeklank: elke dag een vraag, samen.**
   > Beantwoord elke dag dezelfde vraag als je partner. Je ziet het antwoord van de ander pas als je zelf hebt geantwoord. Met gesprekskaarten, quizzen, korte oefeningen en een gedeelde lijst met plannen. Ook fijn als jullie op afstand wonen.
   >
   > Tweeklank blijft gratis. Bestaande functies komen nooit achter een betaalmuur. Geen abonnement, geen advertenties en geen tracking. Jullie antwoorden zijn alleen voor jullie twee.
7. **Privacyverklaring.** Beide stores vragen een URL met een privacyverklaring. Die staat klaar in `docs/index.html`, met dezelfde tekst als in de app.
   - Zet hem online via GitHub: *Settings → Pages → Build and deployment → Deploy from a branch*, kies `main` en de map `/docs`.
   - De URL wordt dan `https://ronaldsteenkamp.github.io/tweeklank/`.
   - Pas je de tekst in `src/app/privacy.tsx` aan? Draai dan `node scripts/make-privacy-page.mjs`.

## Content uitbreiden

Voeg een nieuwe migratie toe, bijvoorbeeld `supabase/migrations/20270101000000_meer_vragen.sql`:

```sql
insert into public.daily_questions (slug, position, depth, text) values
  ('dv-061', 61, 2, 'Jouw nieuwe vraag?')
on conflict (slug) do nothing;
```

Draai daarna `npx supabase db push` en `npm run check:content`. De contentcheck controleert:
- **(bijna) dubbele dagvragen**, ook tegen de bestaande (overlap van inhoudswoorden, `scripts/content-rules.js`);
- **gegenderde woorden** zoals *hij of zij*, *hem of haar*, *vriend*, *man* of *vrouw*, in de content en in de app. Schrijf *je partner* of *de ander*;
- **de diepgangsverdeling** van de dagvragen: ongeveer 45% luchtig, 35% persoonlijk en 20% diep, in totaal en per portie van 60.

Een bestaande tekst aanpassen? Gebruik een `update … where slug = …;` op één regel, zoals in `…_inclusief.sql`. De contentcheck leest die updates mee.

Het werkt hetzelfde voor quizzen (`quizzes`, `quiz_questions`), kaarten (`themes`, `theme_questions`), oefeningen (`exercises`) en date-ideeën (`date_ideas`). Kijk naar de bestaande `…_content_….sql`-migraties als voorbeeld.
