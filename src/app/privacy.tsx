import { AppText, Card, Screen } from '@/components/ui';

const ITEMS: [string, string][] = [
  ['Wat we bewaren', 'Je naam (en je e-mailadres als je daarmee inlogt), jullie antwoorden en reacties, quizantwoorden, gemarkeerde kaarten, afgevinkte oefeningen, plannen, belangrijke datums, jullie weekdoel en pauzes, jullie keuze voor een themaweek, jullie maandelijkse check-ins, en je instellingen in de app. Wie van jullie welke dag miste, wordt nergens getoond.'],
  ['Wie het kan zien', 'Alleen jij en je gekoppelde partner. Dat wordt afgedwongen in de database zelf (row level security), niet alleen in de app.'],
  ['Niet spieken', 'Het antwoord van je partner op de dagvraag, de quizantwoorden en de maandelijkse check-in zie je pas nadat je zelf hebt geantwoord. Ook dat regelt de database, niet alleen de app.'],
  ['18+-kaarten', 'De 18+-set is alleen zichtbaar als jullie hem allebei aanzetten en bevestigen dat je 18 jaar of ouder bent. Zet een van jullie hem uit, dan verdwijnt hij direct voor allebei.'],
  ['Wat we niet doen', 'Geen advertenties, geen analytics- of trackingdiensten, geen verkoop of delen van gegevens.'],
  ['Thuisschermwidget', 'De widget toont alleen of de vraag van vandaag klaarstaat, of je partner heeft geantwoord en eventueel een aftelteller. Nooit de inhoud van een antwoord. De vraag zelf staat er alleen op als je dat aanzet. De app geeft deze gegevens op je telefoon door aan de widget; de widget haalt zelf niets van internet.'],
  ['Ons jaar', 'Het jaaroverzicht wordt op je telefoon gemaakt uit wat jullie al konden zien. We bewaren alleen of jullie allebei toestemming geven om dat overzicht als afbeelding te delen. Zonder toestemming van allebei kun je het alleen zelf bekijken.'],
  ['Samen kaarten spelen', 'Als jullie samen kaarten spelen, bewaren we alleen welke kaart er open ligt, zodat jullie allebei dezelfde zien. Die sessie wordt gewist als een van jullie stopt, en anders na twee uur.'],
  ['Ontkoppelen', 'Bij ontkoppelen worden alle gedeelde gegevens van jullie koppel definitief verwijderd, voor jullie allebei.'],
  ['Nieuwe telefoon', 'Met een overzetcode (Ik → Naar een nieuwe telefoon) neem je je account mee. De code is 15 minuten en één keer geldig, en in de database staat alleen een onleesbare versie (hash) ervan. Een account zonder e-mail krijgt daarbij een intern adres dat niet bestaat; daar wordt nooit iets naartoe gestuurd.'],
  ['Je gegevens meenemen', 'Onder Ik → Jullie gegevens downloaden maak je een export als JSON-bestand of als leesbare pagina (je recht op overdraagbaarheid, AVG artikel 20). Daarin staan je eigen antwoorden, de antwoorden van je partner op dagen dat jullie allebei antwoordden, en de reacties, plannen en datums. Het bestand wordt op je telefoon gemaakt; er blijft geen kopie op een server.'],
  ['Herstelcode', 'Een herstelcode is 16 tekens, lang geldig en één keer te gebruiken. Net als bij de overzetcode staat alleen een onleesbare versie (hash) in de database. Wie de code heeft, komt in je account: deel hem met niemand.'],
  ['Account verwijderen', 'Via Ik → Account verwijderen wis je je account en alle bijbehorende gegevens definitief.'],
  ['Meldingen', 'Pushmeldingen gaan via de bezorgdienst van Expo naar Apple en Google. Er staat nooit de inhoud van een antwoord in. Je kunt ze per soort uitzetten en zelf het uur van de dagmelding kiezen. Een "Ik denk aan je" bevat alleen je naam; we bewaren alleen dat je het die dag stuurde, zodat het één keer per dag kan.'],
  ['Opslag', 'Je gegevens staan in de database (Supabase) van degene die deze app aanbiedt. Je inlogsessie wordt versleuteld op je telefoon bewaard.'],
];

export default function Privacy() {
  return (
    <Screen>
      {ITEMS.map(([title, body]) => (
        <Card key={title}>
          <AppText variant="large">{title}</AppText>
          <AppText>{body}</AppText>
        </Card>
      ))}
    </Screen>
  );
}
