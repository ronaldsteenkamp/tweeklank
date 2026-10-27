import { AppText, Card, Screen } from '@/components/ui';

const ITEMS: [string, string][] = [
  ['Wat we bewaren', 'Je naam (en je e-mailadres als je daarmee inlogt), jullie antwoorden en reacties, quizantwoorden, gemarkeerde kaarten, afgevinkte oefeningen, plannen, belangrijke datums, en jullie weekdoel en pauzes. Wie van jullie welke dag miste, wordt nergens getoond.'],
  ['Wie het kan zien', 'Alleen jij en je gekoppelde partner. Dat wordt afgedwongen in de database zelf (row level security), niet alleen in de app.'],
  ['Niet spieken', 'Het antwoord van je partner op de dagvraag en de quizantwoorden zie je pas nadat je zelf hebt geantwoord. Ook dat regelt de database, niet alleen de app.'],
  ['18+-kaarten', 'De 18+-set is alleen zichtbaar als jullie hem allebei aanzetten en bevestigen dat je 18 jaar of ouder bent. Zet een van jullie hem uit, dan verdwijnt hij direct voor allebei.'],
  ['Wat we niet doen', 'Geen advertenties, geen analytics- of trackingdiensten, geen verkoop of delen van gegevens.'],
  ['Ontkoppelen', 'Bij ontkoppelen worden alle gedeelde gegevens van jullie koppel definitief verwijderd, voor jullie allebei.'],
  ['Nieuwe telefoon', 'Met een overzetcode (Ik → Naar een nieuwe telefoon) neem je je account mee. De code is 15 minuten en één keer geldig, en in de database staat alleen een onleesbare versie (hash) ervan. Een account zonder e-mail krijgt daarbij een intern adres dat niet bestaat; daar wordt nooit iets naartoe gestuurd.'],
  ['Account verwijderen', 'Via Ik → Account verwijderen wis je je account en alle bijbehorende gegevens definitief.'],
  ['Meldingen', 'Pushmeldingen gaan via de bezorgdienst van Expo naar Apple en Google. Er staat nooit de inhoud van een antwoord in. Je kunt ze per soort uitzetten.'],
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
