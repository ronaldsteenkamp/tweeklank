import { AppText, Card, Screen } from '@/components/ui';

const ITEMS: [string, string][] = [
  ['Wat we bewaren', 'Je e-mailadres (om in te loggen), je naam, jullie antwoorden, reacties en wat jullie samen opslaan in de app.'],
  ['Wie het kan zien', 'Alleen jij en je gekoppelde partner. Dat wordt afgedwongen in de database zelf (row level security), niet alleen in de app.'],
  ['Wat we niet doen', 'Geen advertenties, geen analytics- of trackingdiensten, geen verkoop of delen van gegevens.'],
  ['Ontkoppelen', 'Bij ontkoppelen worden alle gedeelde gegevens van jullie koppel definitief verwijderd, voor jullie allebei.'],
  ['Account verwijderen', 'Via Ik → Account verwijderen wis je je account en alle bijbehorende gegevens definitief.'],
  ['Meldingen', 'Pushmeldingen gaan via de bezorgdienst van Expo naar Apple/Google. Je kunt ze altijd uitzetten.'],
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
